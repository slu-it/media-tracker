# Media Tracker

A small, self-hosted tracker for media lists (books, films, series, games) with a login gate.
One fat JAR (Ktor + React) on a Raspberry Pi, MariaDB at a web host, Gradle as the only build tool you
touch.

| Layer | Stack |
|---|---|
| Build | Gradle 9.7 wrapper, JDK 25 toolchain, Gradle-managed Node 24 + pnpm 10 |
| Backend | Kotlin 2.4, Ktor 3.5 (CIO), Exposed 1.5, HikariCP 7, MariaDB Connector/J, Argon2id (Bouncy Castle) |
| Frontend | React 19, TypeScript 6, Vite 8, MUI 9 (Material Design), i18next (EN/DE), Vitest 5 |
| Runtime | systemd on the Pi, environment-file configuration, sessions in MariaDB |

## Prerequisites

- JDK 25 (Temurin or Zulu; ARM64 builds on the Pi). Nothing else: the Gradle wrapper downloads Gradle,
  and the build downloads Node and pnpm.
- A MariaDB 11.8 database and, for local development, its credentials (or a throwaway MariaDB in Docker).
- Docker (or a compatible container runtime) for the backend tests: they run against a Testcontainers
  `mariadb:11.8`, the same engine as production (decision record 0015).

## Everyday commands

| Goal | Command |
|---|---|
| Full build, all tests, lint and format checks, fat JAR | `./gradlew build` |
| Dev loop: backend auto-reload + frontend hot reload | `./start-dev.sh` (see "Local dev loop" below) |
| Backend only (serves last built frontend) | `./gradlew :backend:run` |
| Frontend hot reload only | `cd frontend && pnpm dev` (proxies `/api`, `/login`, `/logout`, `/health` to `localhost:8080`; see note below) |
| Backend tests (Testcontainers MariaDB, needs Docker) | `./gradlew :backend:test` |
| Backend test coverage (Kover HTML + XML, also produced by `./gradlew build`) | `./gradlew :backend:koverHtmlReport`, then open `backend/build/reports/kover/html/index.html` |
| Frontend tests (also writes the Vitest V8 coverage report) | `./gradlew :frontend:pnpmTest` or `cd frontend && pnpm test`, then open `frontend/build/coverage/index.html` |
| Kotlin style check / auto-format (ktlint) | `./gradlew :backend:ktlintCheck` / `./gradlew :backend:ktlintFormat` |
| Frontend lint / format check (ESLint, Prettier) | `./gradlew :frontend:pnpmLint` / `./gradlew :frontend:pnpmFormatCheck`, or `cd frontend && pnpm lint` / `pnpm format:check` |
| Frontend auto-fix | `cd frontend && pnpm format && pnpm lint:fix` (or `./gradlew :frontend:pnpmFormat :frontend:pnpmLintFix`) |
| Release artifact | `./gradlew :backend:buildFatJar` then `backend/build/libs/media-tracker.jar` |

`pnpm` on your PATH: with Node 24 installed, run `corepack enable` once and Corepack will use the exact
pnpm version pinned in `frontend/package.json`. Alternatively use the copy Gradle downloaded under
`frontend/.gradle/pnpm/`. The dev server needs the backend running on port 8080 for logins to work.

The backend needs four environment variables at runtime (see `deploy/env.example`):

```
DB_URL=jdbc:mariadb://host:3306/mediatracker?sslMode=verify-full&timezone=UTC&preserveInstants=true
DB_USER=...
DB_PASSWORD=...
SESSION_SECRET=<long random string>
```

Optional: `PORT` (default 8080) and `SESSION_SECURE=false` for plain-http testing on a LAN.

## First user

There is no self-registration. Create the first account with the same environment as the server:

```
java -cp backend/build/libs/media-tracker.jar de.sluit.mediatracker.auth.CreateUser <username>
```

You are prompted for the password (twice). Add `--reset-password` to change an existing user's password.

## MCP server

The backend exposes a [Model Context Protocol](https://modelcontextprotocol.io) server at `POST /mcp`
(stateless Streamable HTTP) so any MCP-capable agent can add games. It is authenticated with a per-user API key,
not with the browser session:

1. Log in, open the settings (gear icon) and the **API Keys** tab, generate the primary key and copy it.
2. Point your client at `https://<host>/mcp` with the header `X-API-Key: <key>`. Clients that can only send an
   OAuth-style header may use `Authorization: Bearer <key>` instead. Claude Code, for example:
   ```
   claude mcp add --transport http media-tracker https://<host>/mcp --header "X-API-Key: <key>"
   ```
3. Tools: `list_game_platforms` (ids and labels of the seeded platforms), `add_game` (same fields as
   `POST /api/games`: `title`, `releaseYear`, `platformIds` required; `description`, `rating`, `coverImageUrl` optional)
   and `search_games` (`query`: words to search for in title and description; returns the ten best matches).

Each user has two key slots. To rotate without downtime, generate the secondary key, switch the client to it, then
regenerate the primary. Regenerating a slot invalidates its old key immediately. Details in
`docs/architecture.md` and `docs/decisions/0013-api-keys-and-mcp-server.md`.

## Local end-to-end run

```
./build-and-start-locally.sh
```

The script starts the MariaDB from `docker-compose.yml` if it is not running (data lives in a named volume
and survives restarts), builds everything, makes sure the local user `slu` exists (you are prompted for a
password only the first time, or set `MT_LOCAL_PASSWORD`), and starts the app on http://localhost:8080.
`MT_SKIP_BUILD=1` starts the last built JAR without rebuilding. `docker compose down` stops the database,
`docker compose down -v` also deletes its data (add `--remove-orphans` once if a container from the MySQL era is
still around, it holds port 3306).

The schema is managed by Flyway (`backend/src/main/resources/db/migration`) and applied automatically when the
application or `CreateUser` connects. A database that was created before Flyway was introduced has tables but no
`flyway_schema_history` table; Flyway refuses to touch it ("Found non-empty schema(s) ... but no schema history
table"). Reset such a local database once with `docker compose down -v --remove-orphans`. The same reset is needed
once for any local database created before the move to MariaDB (`docs/decisions/0014-*.md`): all three scripts were
renamed and edited, so Flyway reports checksum mismatches, and a MySQL data directory cannot be opened by MariaDB
anyway. Earlier, the same applied to databases created before `V002__games.sql` was amended on the MT-001 branch
(`docs/decisions/0009-*.md`). `build-and-start-locally.sh` recreates the `slu` user afterwards.

The same steps by hand:

```
docker compose up -d --wait
export DB_URL='jdbc:mariadb://127.0.0.1:3306/mediatracker?sslMode=disable&timezone=UTC&preserveInstants=true'
export DB_USER=mediatracker DB_PASSWORD=mediatracker SESSION_SECRET=local-dev-secret-local-dev-secret SESSION_SECURE=false
./gradlew build
java -cp backend/build/libs/media-tracker.jar de.sluit.mediatracker.auth.CreateUser slu
java -jar backend/build/libs/media-tracker.jar      # http://localhost:8080
```

## Local dev loop

```
./start-dev.sh
```

Starts the MariaDB container, then three processes: the backend from compiled classes with Ktor development mode
(`./gradlew :backend:run -Pmt.dev=true`), a Gradle continuous build that recompiles the backend on
every Kotlin or resource change (`./gradlew :backend:classes -t`), and the Vite dev server (`pnpm dev`). Open
http://localhost:5173: Vite serves the React app with hot module replacement and proxies `/api`, `/login`,
`/logout` and `/health` to `:8080`, so the login gate and the session cookie behave as in production. The
backend swaps in recompiled classes on the first request after a change (the log says "Changes in application
detected"). `application.yaml` and build-script edits still need a restart. Ctrl+C stops everything except the
database. `pnpm` does not have to be installed; the script falls back to the copy Gradle downloaded.

Both Gradle invocations pass `-Pmt.dev=true` (defined in `backend/build.gradle.kts`). It makes
`:backend:processResources` skip building and copying the SPA (Vite serves it), so a frontend edit never triggers
a Vite production build, and it gives the `run` task the `-Dio.ktor.development=true` JVM flag that turns on Ktor
auto-reload. Never pass that property to `build` or `buildFatJar`. The local user `slu` is created via the last built fat JAR if there is one;
otherwise run `./build-and-start-locally.sh` once, the database volume keeps the user afterwards.

The same loop by hand, in three terminals (environment as in `local-env.sh`):

```
./gradlew :backend:run -Pmt.dev=true
./gradlew :backend:classes -t -Pmt.dev=true
cd frontend && pnpm dev
```

## Continuous integration

Two GitHub Actions workflows in `.github/workflows/`, both running `./gradlew build` on JDK 25:

| Workflow | Trigger | Result |
|---|---|---|
| `pr.yml` | pull requests targeting `master` | lint, format check, tests; fails the PR on any violation |
| `master.yml` | push to `master`, manual dispatch | same checks, then `media-tracker.jar` is kept as the workflow artifact `media-tracker-jar` for 30 days |

Test and lint reports are uploaded as the `reports` artifact when a run fails. Deployment to the Pi remains manual.

## Deploy to the Pi

1. `./gradlew :backend:buildFatJar`
2. `scp backend/build/libs/media-tracker.jar pi:/opt/media-tracker/`
3. `ssh pi sudo systemctl restart media-tracker`

First-time setup of the unit, user, and environment file is described at the top of
`deploy/media-tracker.service`.

## Repository layout

```
backend/    Ktor application (see docs/architecture.md for the module map)
frontend/   Vite + React app, wrapped by Gradle; `pnpm dev` for the hot-reload loop (or `./start-dev.sh` for both)
deploy/     systemd unit, environment template, JVM options for the Pi
docs/       architecture overview and decision records
gradle/     wrapper and libs.versions.toml (single source of truth for JVM versions)
```

Phase 1 shipped the build, the login gate and the user session. Phase 2 adds the media kinds one by one:
Games are implemented (grid, add/edit/delete dialogs with description, star rating and multi-platform chips,
`/api/games` and the read-only `/api/game-platforms`; see `docs/architecture.md` for the API and
`docs/decisions/0007-*.md` / `0008-*.md` / `0009-*.md` for the backend, frontend and reference-data patterns),
plus per-user API keys and the MCP server (`0013-*.md`) and the move to MariaDB 11.8 (`0014-*.md`); Books, Movies and
Series are "coming soon" tabs.
