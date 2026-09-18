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
        ──GET /api/games───▶ authenticate("session") ─▶ GameRoutes ─▶ GameService ─▶ ExposedGameRepository ─▶ MySQL
        ──POST /logout─────▶ sessions row deleted, cookie cleared ─▶ 302 /login
```

Two tiers share one port:

| Tier | Paths | Auth |
|---|---|---|
| Public | `/login` (GET form, POST credentials), `/login/static/*` (CSS), `/logout`, `/health` | none |
| Authenticated | `/` and everything under it (SPA, falls back to `index.html`), `/api/**` | session cookie |

Unauthenticated requests to `/api/**` get a JSON `401`; unauthenticated browser navigation is redirected
to `/login`. Both are decided in `auth/api/Security.kt`.

## Sessions

- The cookie carries only a random session id, HMAC-signed with `SESSION_SECRET`
  (`SessionTransportTransformerMessageAuthentication`). `HttpOnly`, `SameSite=Lax`, `Secure` unless
  `SESSION_SECURE=false`.
- The `sessions` table holds `(id, user_id, created_at, expires_at)`. `DbSessionStorage` rebuilds the
  `UserSession` principal from a join with `users` on every request and deletes expired rows lazily.
- Passwords are Argon2id hashes in PHC string form (`auth/domain/PasswordHasher.kt`). Parameters are embedded in
  the string, so they can be raised later without a migration.
- There is no self-registration. The first user is created with the bootstrap entry point:
  `java -cp media-tracker.jar de.sluit.mediatracker.auth.CreateUser <username>`.

## Module map (backend)

```
de.sluit.mediatracker
├── Application.kt      module(): config -> database -> drift warning -> Services -> configureHttp (plugins -> routes)
├── Routes.kt           apiRoutes (meRoutes + feature routes under the authenticated /api prefix, JSON 404
│                       catch-all) and webRoutes (/health, session-gated SPA from classpath /app)
├── Schema.kt           allTables: every Exposed table object, for the schema drift check
├── config/             AppConfig, DatabaseConfig, SessionConfig (typed application.yaml)
├── common/             shared code in the same three layers as a feature; knows no feature:
│   ├── api/            shared DTOs (ErrorResponse, HealthResponse, PageResponse<T>; mirrored in
│   │                   frontend/src/types/api.ts), PatchField (+ serializer), Paging (?page/?pageSize parsing)
│   ├── domain/         InvalidValueException/NotFoundException/requireValid,
│   │                   PageNumber/PageSize/PageRequest/Page<T>, Patch<T>
│   └── persistence/    DatabaseFactory (HikariCP, Flyway migrate, Exposed, drift statements), dbQuery()
├── plugins/            Serialization, Monitoring, StatusPages
├── auth/               CreateUser (bootstrap CLI) plus the same three layers as a media kind:
│   ├── api/            LoginRoutes (/login, /logout), MeRoutes (/api/me) + AuthDtos, Security (SESSION_AUTH,
│   │                   session auth + challenge), Sessions (cookie + storage plugin), UserSession (principal),
│   │                   DbSessionStorage
│   ├── domain/         AuthService, PasswordHasher (Argon2id), User + UserRepository,
│   │                   StoredSession + SessionRepository
│   └── persistence/    UsersTable, SessionsTable, ExposedUserRepository (+ *Blocking helpers),
│                       ExposedSessionRepository
└── games/              first media kind (MT-001), the template for Books/Movies/Series (decision record 0007):
    ├── api/            GameDtos (+ DTO <-> domain mappers), GameRoutes (/api/games, /api/game-platforms)
    ├── domain/         GameValues (GameId, Title, ReleaseYear, Description, Rating, CoverImageUrl,
    │                   GamePlatformId, PlatformLabel, HexColor), Game/NewGame/GamePatch, GamePlatform,
    │                   GameRepository and GamePlatformRepository (interfaces), GameService
    └── persistence/    GamesTable, GamePlatformsTable, GameToPlatformTable (Exposed), ExposedGameRepository,
                        ExposedGamePlatformRepository
```

Layer rule inside a feature: `api -> domain <- persistence`; the domain imports neither Ktor nor Exposed nor
kotlinx.serialization (pure libraries such as Bouncy Castle or slf4j are fine). Only domain objects and value
classes cross a layer boundary; constructing a value class is the validation. The shared top-level packages
(`common`, `plugins`, `config`) never import a feature package. The files that know every feature live in the
package root (`Application.kt`, `Routes.kt`, `Schema.kt`). Decision record 0010.

## API

All `/api/**` routes need a session cookie; without one they answer `401 {"error":"unauthorized"}`.

| Method and path | Success | Notes |
|---|---|---|
| `GET /api/me` | 200 `{"username"}` | |
| `GET /api/games?page=1&pageSize=50` | 200 `PageResponse<GameResponse>` | 1-based `page`, `pageSize` 1..200 (default 50); ordered by title, id; `totalPages` 0 when empty |
| `POST /api/games` | 201 `GameResponse` + `Location` | body `CreateGameRequest`: `platformIds` (at least one seeded platform id), `description` (max 10000 chars), `rating` (0.25..5 in quarter steps) and `coverImageUrl` optional |
| `PATCH /api/games/{id}` | 200 `GameResponse` | body `UpdateGameRequest`: omit a field to keep it, `null` clears `description`, `rating` or `coverImageUrl`, `platformIds` replaces the whole set; 404 for unknown ids |
| `DELETE /api/games/{id}` | 204 | also for unknown ids (idempotent); junction rows go with the game (`ON DELETE CASCADE`) |
| `GET /api/game-platforms` | 200 `GamePlatformResponse[]` | seeded reference data (`id`, `label`, `associatedColor` as `RRGGBB`), ordered by label; read-only for now (decision record 0009) |

Errors are `ErrorResponse {error, message?}` with codes `validation_error` (400, a value class rejected a field:
`"title: must not be blank"`), `invalid_body` (400, malformed or ill-typed JSON, missing body), `not_found` (404),
`unauthorized` (401), `internal_error` (500). The mapping lives in `plugins/StatusPages.kt`.

## Module map (frontend)

```
frontend/src
├── main.tsx / App.tsx / AppProviders.tsx   i18n init, theme + CssBaseline, shell (AppHeader, MediaTabs, active view)
├── theme/theme.ts        MUI theme: login-page palette, light/dark by OS preference, system font stack
├── i18n/                 i18next setup, en.json / de.json bundles (typed keys via i18next.d.ts), language storage
├── api/client.ts         apiFetch (401 -> /login, 204 -> undefined, ApiError with the parsed ErrorResponse)
├── types/api.ts          hand-written mirrors of the backend DTOs
├── hooks/                useLocalStorageState, useStoredTab (selected media tab)
├── components/           shared UI: layout/ (AppHeader, LanguageMenu, LogoutButton, MediaTabs, mediaKinds),
│                         dialog/ (BaseDialog, ConfirmDialog, DialogActionButton), CoverImage, ComingSoon
├── features/<kind>/      one standalone view per media kind; books, movies, series are "coming soon"
└── features/games/       GamesView + api/ (gamesApi), hooks/ (useGamesPage), domain/ (gameValues validators,
                          gameDraft), components/ (grid, cards, pagination, detail/add dialogs, fields/)
```

Browser state: `localStorage["mt.language"]` (`en`/`de`) and `localStorage["mt.mediaTab"]` (`books`/`games`/`movies`/
`series`). The SPA does not call `/api/me` at startup; being served `index.html` already implies a valid session,
and any later 401 redirects to the login page. Decision record 0008 covers the UI stack.

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
`backend/src/main/resources/db/migration` and binds Exposed; `module()` then calls
`DatabaseFactory.warnOnSchemaDrift(database, allTables)`, which logs a warning if the table objects registered in
`Schema.kt` differ from the live schema (Exposed's `MigrationUtils` diff, read-only). Decision record 0004 has the
reasoning.

Rules:

- One script per change, named `V<n>__<snake_case>.sql`. Strict naming validation is on, so only migration
  files may live in that folder. Never edit a script once it has been applied anywhere; add `V<n+1>`.
- Write SQL that runs on MySQL 8.x and on H2 in MySQL mode (the test database). `ENGINE=`, charset and collation
  clauses are fine (H2 ignores them); avoid MySQL-only syntax beyond that.
- Timestamp columns use the placeholder `${timestamp_type}` (`DATETIME(6)` on MySQL, `TIMESTAMP(9)` on H2, from
  `database.migration.timestampType`).
- Give foreign-key columns an explicit index in SQL and `.index()` in Kotlin.
- Mirror every change in the Exposed table object in the same commit (`<feature>/persistence/*Table.kt`, e.g.
  `auth/persistence/UsersTable.kt`; every table object is listed in `allTables` in `Schema.kt`, the package
  root). `SchemaDriftTest` fails when scripts and Kotlin tables disagree, and prints the statements
  Exposed would need.
- UUID primary keys are `CHAR(36)` (hex-dash text), not Exposed's `uuid()`; see decision record 0007.
- Reference data that the app needs from day one (the game platforms) is seeded by the migration that creates
  its table, with fixed ids; see decision record 0009. `V2__games.sql` was amended in place once, before the
  first release, under that record; the rule above holds from now on.

## Developer loop

| Goal | Command |
|---|---|
| Everything (lint, format check, tests, fat JAR) | `./gradlew build` |
| Dev loop with live reload (backend + frontend) | `./start-dev.sh`: Docker MySQL, `:backend:run` in Ktor development mode, `:backend:classes -t`, `pnpm dev`; see decision record 0006 |
| Backend only | `./gradlew :backend:run` (needs `DB_URL`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET` in the environment; add `-Pmt.dev=true` for auto-reload without the SPA) |
| Frontend hot reload only | `cd frontend && pnpm dev` (proxies `/api`, `/login`, `/logout`, `/health` to `:8080`) |
| Backend tests (handler tests without a database, smoke/repository tests on H2 in MySQL mode, schema drift test; ADR 0011) | `./gradlew :backend:test` |
| Backend coverage report (Kover, informational, decision record 0011) | `./gradlew :backend:koverHtmlReport` |
| Frontend tests (Vitest) | `./gradlew :frontend:pnpmTest` |
| Kotlin style (ktlint, `intellij_idea` style from `.editorconfig`) | `./gradlew :backend:ktlintCheck` / `:backend:ktlintFormat` |
| Frontend lint and format (ESLint, Prettier) | `./gradlew :frontend:pnpmLint :frontend:pnpmFormatCheck` / `:frontend:pnpmFormat :frontend:pnpmLintFix` |
| Release artifact | `./gradlew :backend:buildFatJar` then `backend/build/libs/media-tracker.jar` |

Lint and format checks are part of each project's `check` task, so `./gradlew build` fails on violations. Decision record 0005 explains the tool choice and why detekt is deferred.
