# Architecture

Media Tracker is a single JAR: a Ktor server that hosts a JSON API, a hand-written login page, and the
compiled React single-page app. It runs on a Raspberry Pi and talks to a MySQL database at a web host.
The full version matrix and its reasoning live in `tmp/project-description.md` (not committed) and in
the decision records under `decisions/`.

## Request flow

```
Browser ──GET /────────────▶ Ktor ── no valid session ──▶ 302 /login
        ◀─ login.html ─────  (public tier: /login, /login/static/*, /health)
        ──POST /login──────▶ AuthService.login ─▶ Argon2id verify ─▶ sessions row ─▶ Set-Cookie MT_SESSION=<signed id>
        ──GET / (+cookie)──▶ DbSessionStorage.read ─▶ UserSession principal ─▶ app/index.html
        ──GET /api/me──────▶ authenticate("session") ─▶ {"username": "..."}
        ──POST /logout─────▶ sessions row deleted, cookie cleared ─▶ 302 /login
```

Two tiers share one port:

| Tier | Paths | Auth |
|---|---|---|
| Public | `/login` (GET form, POST credentials), `/login/static/*` (CSS), `/logout`, `/health` | none |
| Authenticated | `/` and everything under it (SPA, falls back to `index.html`), `/api/**` | session cookie |

Unauthenticated requests to `/api/**` get a JSON `401`; unauthenticated browser navigation is redirected
to `/login`. Both are decided in `plugins/Security.kt`.

## Sessions

- The cookie carries only a random session id, HMAC-signed with `SESSION_SECRET`
  (`SessionTransportTransformerMessageAuthentication`). `HttpOnly`, `SameSite=Lax`, `Secure` unless
  `SESSION_SECURE=false`.
- The `sessions` table holds `(id, user_id, created_at, expires_at)`. `DbSessionStorage` rebuilds the
  `UserSession` principal from a join with `users` on every request and deletes expired rows lazily.
- Passwords are Argon2id hashes in PHC string form (`auth/PasswordHasher.kt`). Parameters are embedded in
  the string, so they can be raised later without a migration.
- There is no self-registration. The first user is created with the bootstrap entry point:
  `java -cp media-tracker.jar de.sluit.mediatracker.auth.CreateUser <username>`.

## Module map (backend)

```
de.sluit.mediatracker
├── Application.kt      module(): config -> database -> services -> plugins -> routes
├── config/             AppConfig, DatabaseConfig, SessionConfig (typed application.yaml)
├── db/                 DatabaseFactory (HikariCP, Flyway migrate, Exposed, drift warning), Tables, dbQuery()
├── auth/               PasswordHasher, UserSession, repositories, DbSessionStorage, AuthService,
│                       LoginRoutes (/login, /logout), CreateUser (bootstrap CLI)
├── plugins/            Serialization, Monitoring, StatusPages, Sessions, Security
├── api/                /api routes + @Serializable DTOs (mirrored in frontend/src/types/api.ts)
├── web/                /health and the session-gated SPA (classpath /app)
└── media/              empty; phase 2 domain (MediaList, MediaItem, statuses)
```

## Build pipeline

```
frontend/src ──pnpm build (Vite 8)──▶ frontend/build/dist ──"frontendDist" variant──▶
backend processResources ──▶ build/resources/main/app/** ──▶ shadowJar ──▶ backend/build/libs/media-tracker.jar
```

- `:frontend` exposes its Vite output directory as a consumable configuration with the
  `LibraryElements=frontend-dist` attribute. `:backend` resolves it like any dependency and copies it into
  the `app/` resource folder. No project reaches into another project's task graph, so the build works
  with the configuration cache and stays compatible with Gradle's isolated projects.
- `backend/src/main/resources/app/` is therefore never written to and is ignored by git.
- `-Pmt.dev=true` (used only by `start-dev.sh`) removes the `frontendDist` copy from
  `:backend:processResources`, so the backend dev loop neither builds the SPA nor watches `frontend/src`
  (the Vite dev server serves it), and adds `-Dio.ktor.development=true` to `:backend:run` for Ktor
  auto-reload. Never use it for `build` or `buildFatJar`.
- Node 24 and pnpm 10 are downloaded by the `com.github.node-gradle.node` plugin into `frontend/.gradle/`;
  nothing has to be installed by hand except a JDK 25.

## Runtime on the Pi

- `deploy/media-tracker.service` runs `java @jvm.options -jar media-tracker.jar` as an unprivileged user
  with `Restart=on-failure` and `EnvironmentFile=/etc/media-tracker/env`.
- `deploy/jvm.options`: 192 MB heap, SerialGC, C1 only, auto-created CDS archive for faster restarts.
- HikariCP is tuned for a remote, idle-killing MySQL: `maximumPoolSize=3`, `minimumIdle=1`,
  `keepaliveTime=300000`, `maxLifetime=1500000`.
- The schema is applied by Flyway at startup (see "Schema migrations"); the application never alters the
  schema itself. A pre-Flyway database (tables but no history table) stops startup with a clear error.
- Static assets are served `Cache-Control: private`; Vite's hashed `/assets/*` may be cached for a year,
  `index.html` never.

## Schema migrations

Flyway owns the schema. `DatabaseFactory.connect` opens the pool, runs `flyway.migrate()` over
`backend/src/main/resources/db/migration`, binds Exposed, and finally logs a warning if the Kotlin table objects
differ from the live schema (Exposed's `MigrationUtils` diff, read-only). Decision record 0004 has the reasoning.

Rules:

- One script per change, named `V<n>__<snake_case>.sql`. Strict naming validation is on, so only migration
  files may live in that folder. Never edit a script once it has been applied anywhere; add `V<n+1>`.
- Write SQL that runs on MySQL 8.x and on H2 in MySQL mode (the test database). `ENGINE=`, charset and collation
  clauses are fine (H2 ignores them); avoid MySQL-only syntax beyond that.
- Timestamp columns use the placeholder `${timestamp_type}` (`DATETIME(6)` on MySQL, `TIMESTAMP(9)` on H2, from
  `database.migration.timestampType`).
- Give foreign-key columns an explicit index in SQL and `.index()` in Kotlin.
- Mirror every change in `db/Tables.kt` in the same commit. `SchemaDriftTest` fails when scripts and Kotlin
  tables disagree, and prints the statements Exposed would need.

## Developer loop

| Goal | Command |
|---|---|
| Everything (lint, format check, tests, fat JAR) | `./gradlew build` |
| Dev loop with live reload (backend + frontend) | `./start-dev.sh`: Docker MySQL, `:backend:run` in Ktor development mode, `:backend:classes -t`, `pnpm dev`; see decision record 0006 |
| Backend only | `./gradlew :backend:run` (needs `DB_URL`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET` in the environment; add `-Pmt.dev=true` for auto-reload without the SPA) |
| Frontend hot reload only | `cd frontend && pnpm dev` (proxies `/api`, `/login`, `/logout`, `/health` to `:8080`) |
| Backend tests (H2 in MySQL mode, includes the schema drift test) | `./gradlew :backend:test` |
| Frontend tests (Vitest) | `./gradlew :frontend:pnpmTest` |
| Kotlin style (ktlint, `intellij_idea` style from `.editorconfig`) | `./gradlew :backend:ktlintCheck` / `:backend:ktlintFormat` |
| Frontend lint and format (ESLint, Prettier) | `./gradlew :frontend:pnpmLint :frontend:pnpmFormatCheck` / `:frontend:pnpmFormat :frontend:pnpmLintFix` |
| Release artifact | `./gradlew :backend:buildFatJar` then `backend/build/libs/media-tracker.jar` |

Lint and format checks are part of each project's `check` task, so `./gradlew build` fails on violations. Decision record 0005 explains the tool choice and why detekt is deferred.
