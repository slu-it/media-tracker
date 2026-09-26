# Media Tracker

A small, self-hosted tracker for media lists (books, films, series, games) with a login gate.
One fat JAR (Ktor + React) on a Raspberry Pi, next to the central MariaDB that machine shares between its
applications, Gradle as the only build tool you touch.

Feature and decision documentation starts at [docs/index.md](docs/index.md).

| Layer | Stack |
|---|---|
| Build | Gradle 9.7 wrapper, JDK 25 toolchain, Gradle-managed Node 24 + pnpm 10 |
| Backend | Kotlin 2.4, Ktor 3.5 (CIO), Exposed 1.5, HikariCP 7, MariaDB Connector/J, Argon2id (Bouncy Castle) |
| Frontend | React 19, TypeScript 6, Vite 8, MUI 9 (Material Design), i18next (EN/DE), Vitest 5 |
| Runtime | systemd on the Pi, or docker compose with the GHCR image (distroless Java 25); environment-file configuration, sessions in MariaDB |

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
DB_URL=jdbc:mariadb://host:3306/database?sslMode=disable&timezone=UTC&preserveInstants=true
DB_USER=...
DB_PASSWORD=...
SESSION_SECRET=<long random string>
```

Optional: `PORT` (default 8080), `SESSION_SECURE=false` for plain-http testing on a LAN, and `STEAMGRIDDB_API_KEY`
(a free key from your [SteamGridDB profile](https://www.steamgriddb.com/profile/preferences/api)) to enable the cover
picker in the game dialogs (ADR 0024); without it the picker says it is not configured.
`DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET` (as a pair) enable the Dropbox backup, and `BACKUP_DAILY_AT` (default
`03:00`) and `BACKUP_ZONE` (default `Europe/Berlin`) set its daily slot (see [Dropbox backup](#dropbox-backup)).

## Dropbox backup

The JSON export from the settings dialog's **Export / Import** tab is also uploaded daily to
`Apps/<your app>/backup/full-export.json`, and on demand with "Back up to Dropbox now". Dropbox's version history
keeps the older copies ([docs/features/dropbox-backup.md](docs/features/dropbox-backup.md), ADR 0028).

1. In the [Dropbox App Console](https://www.dropbox.com/developers/apps), create an app with **Scoped access** and
   **App folder** access.
2. On its **Permissions** tab, tick `files.content.write` and `files.metadata.read`, then press **Submit** in the
   bar at the bottom of the page. Ticking alone saves nothing. Do this before connecting, because a token only
   carries the scopes the app had when it was granted. If you change the permissions later, disconnect and
   connect again in the tracker. A missing scope shows up in the log as a Dropbox 400 naming the scope.
3. Put the app key and secret from the **Settings** tab into `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET` and
   restart. No redirect URI is needed. Ignore the console's "Generated access token" button: since Dropbox
   retired long-lived tokens in 2021 it only creates tokens that expire after about 4 hours. The tracker gets
   its own non-expiring refresh token in the next step.
4. In the tracker, open Settings → Export / Import → **Open Dropbox**, allow access, copy the code Dropbox shows,
   paste it into the code field, and press **Connect**.

Disconnecting in the same tab revokes the token. Removing the app in Dropbox's "Connected apps" has the same
effect, and the tab then shows "not connected".

## First user

There is no self-registration. Create the first account with the same environment as the server:

```
java -cp backend/build/libs/media-tracker.jar de.sluit.mediatracker.auth.CreateUser <username>
```

You are prompted for the password (twice). Add `--reset-password` to change an existing user's password.

In the compose deployment the same CLI runs inside the image. The service may keep running; `run` starts a
separate container that publishes no ports and gives the prompt a TTY:

```
sudo docker compose run --rm --no-deps -e JAVA_TOOL_OPTIONS= --entrypoint /usr/bin/java media-tracker \
  -cp /app/media-tracker.jar de.sluit.mediatracker.auth.CreateUser <username>
```

`-e JAVA_TOOL_OPTIONS=` is required: it stops this second JVM from rewriting the shared class-data archive that
the running service has mapped into memory. Non-interactively, pipe the password twice and disable the TTY
with `-T`.

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
   `POST /api/games`: `title`, `releaseYear`, `platformIds` required; `description`, `rating`, `coverImageUrl` optional),
   `search_games` (`query`: words to search for in title and description, optional next to the `platformIds`,
   `ownership`, `progress` and `releaseYears` filter arrays and `hasMissing`, which finds games whose
   `description` or `coverImageUrl` is still empty; `pageSize` returns up to 100 matches, 10 by default) and
   `update_game` (same fields as `PATCH /api/games/{id}`: `id` required, everything else optional; only the fields
   passed change, and the id comes from `search_games`), `list_expansions` and `add_expansion` (a game's DLC, by
   the `gameId` from `search_games`; a new expansion is appended to the end of the game's order), and, when
   `STEAMGRIDDB_API_KEY` is set, `find_game_cover` (`title`, optional `releaseYear`; returns the first static
   SteamGridDB cover URL and the game it matched, ready for `coverImageUrl`).

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
| `pr.yml` | pull requests targeting `master` | lint, format check, tests, a `docker build` of the image and a boot check against a MariaDB container; fails the PR on any violation |
| `master.yml` | push to `master`, manual dispatch | same checks, then `media-tracker.jar` is kept as the workflow artifact `media-tracker-jar` for 30 days and the image `ghcr.io/slu-it/media-tracker` (`latest` and `sha-<short>`, linux/arm64 + linux/amd64) is pushed to GHCR |

Test and lint reports are uploaded as the `reports` artifact when a run fails. Deployment to the Pi remains manual
(`scp` or `docker compose pull`).

## Deploy to the Pi

The database comes first: one central MariaDB (`deploy/database`) serves every application on the Pi, and the
app reaches it over a private Docker network. Decision record 0018.

For the application itself there are two paths, described in decision record 0016. Both bind port 8080, so run
one of them on a given Pi, not both, and both read the environment file `/etc/media-tracker/env` (template:
`deploy/env.example`). They are no longer fully interchangeable: the compose path reaches the database over
`pi-db`, the systemd path needs a published port and its own `DB_URL`, and one file cannot hold both.

### The shared database

```
sudo mkdir -p /opt/pi-database
sudo cp -r deploy/database/. /opt/pi-database/      # compose file, conf.d, env.example, both scripts
cd /opt/pi-database
sudo cp env.example env && sudo chmod 600 env      # set MARIADB_ROOT_PASSWORD
sudo docker compose up -d --wait
sudo ./create-database.sh media-tracker
```

`create-database.sh <name> [password]` creates the database together with a user of the same name that owns it
and nothing else, then prints the `DB_URL`, `DB_USER` and `DB_PASSWORD` lines to paste into the application's
environment file. Running it again for a database that exists changes nothing. The password defaults to the
database name reversed; pass a second argument to use a real one.

The server publishes no port. It is reachable only on the Docker network `pi-db`, which this stack creates and
every application stack joins. What follows from that:

- Start the database stack before any application stack, and stop the applications before stopping it. Compose
  names both mistakes clearly: "network pi-db declared as external, but could not be found" one way round,
  "active endpoints" the other.
- To reach the server from outside the network -- an IDE on a laptop, say -- `deploy/database/docker-compose.yml`
  has two commented-out `ports:` blocks ready: (a) `3306:3306` for a direct connection from the LAN, (b)
  `127.0.0.1:3306:3306` for the Pi itself or for an SSH tunnel (`ssh -L 3306:127.0.0.1:3306 pi`), which gets
  the same result without exposing anything. Uncomment one, `docker compose up -d`, and comment it out again
  afterwards. Connect as the application's own user; root is confined to the container's socket. Block (a)
  puts credentials and rows on the LAN unencrypted, so keep it to the length of the debugging session.
- The systemd path below cannot resolve the `mariadb` service name, because it runs on the host. It needs
  block (b) and the matching `DB_URL` from `deploy/env.example`.
- `deploy/database/conf.d/50-tuning.cnf` sizes the server for the Pi: about 110-130 MB resident rather than the
  several hundred a default configuration takes, behind a 512 MB container limit. `innodb_buffer_pool_size` is
  the first value to raise if queries get slow.
- The data lives in `data/` next to the compose file as a bind mount rather than a named volume, owned by
  uid 999, and belongs on an SSD rather than the SD card.
- Backups are the Pi's job now that the database is local: `./backup-database.sh [database]` writes a gzipped
  dump into `backups/` and its header has a cron line. Copying those dumps off the Pi is not automated.
  Independently of that, the settings dialog's **Export / Import** tab downloads a JSON dump of all domain tables
  (no users or sessions) and imports one again, inserting only rows that are missing
  ([docs/features/export-import.md](docs/features/export-import.md)).

### As a systemd service (the fat JAR)

1. `./gradlew :backend:buildFatJar`
2. `scp backend/build/libs/media-tracker.jar pi:/opt/media-tracker/`
3. `ssh pi sudo systemctl restart media-tracker`

First-time setup of the unit, user, and environment file is described at the top of
`deploy/media-tracker.service`. Since the database moved onto the Pi, this path also depends on the database
container: uncomment ports block (b) in `deploy/database/docker-compose.yml`, use the `127.0.0.1`
`DB_URL` from `deploy/env.example`, and expect the unit to restart a few times after a reboot until Docker
has the database up (`Restart=on-failure` handles it; add `After=docker.service` to the unit to avoid the
noise).

### With docker compose (the image from GHCR)

Every push to `master` publishes `ghcr.io/slu-it/media-tracker:latest` (and a `sha-<short>` tag) for
linux/arm64 and linux/amd64. The container runs as uid 65532 on a distroless Temurin 25 with a read-only root
file system; the JVM flags of `deploy/jvm.options` are baked in as `JAVA_TOOL_OPTIONS` and can be overridden in
the compose file.

1. Once: copy `deploy/docker-compose.yml` to `/opt/media-tracker/` and `deploy/env.example` to
   `/etc/media-tracker/env` (mode 600), then fill in the values `create-database.sh` printed. Installation
   notes are at the top of the compose file. The service joins the `pi-db` network, so the database stack has
   to be up first.
2. `cd /opt/media-tracker && sudo docker compose up -d`
3. Update to a new build: `sudo docker compose pull && sudo docker compose up -d`

`sudo docker compose logs -f` follows the log. The first push creates the GHCR package as private; switch its
visibility to public once in the package settings, or log the Pi in with a token that has `read:packages`.

To build and run the image locally instead of pulling it:

```
./gradlew :backend:buildFatJar && docker build -t media-tracker:local .
```

## Repository layout

```
Dockerfile  runtime image: the fat JAR on distroless Java 25, built and pushed to GHCR by master.yml
backend/    Ktor application (see docs/architecture.md for the module map)
frontend/   Vite + React app, wrapped by Gradle; `pnpm dev` for the hot-reload loop (or `./start-dev.sh` for both)
deploy/     systemd unit, docker compose file, environment template, JVM options for the Pi
deploy/database/  the central MariaDB every application on the Pi shares (decision record 0018)
docs/       architecture overview and decision records
gradle/     wrapper and libs.versions.toml (single source of truth for JVM versions)
```

Phase 1 shipped the build, the login gate and the user session. Phase 2 adds the media kinds one by one:
Games are implemented (grid, add/edit/delete dialogs with description, star rating and multi-platform chips,
`/api/games` and the read-only `/api/game-platforms`; see `docs/architecture.md` for the API and
`docs/decisions/0007-*.md` / `0008-*.md` / `0009-*.md` for the backend, frontend and reference-data patterns),
plus per-user API keys and the MCP server (`0013-*.md`) and the move to MariaDB 11.8 (`0014-*.md`); Books, Movies and
Series are "coming soon" tabs.
