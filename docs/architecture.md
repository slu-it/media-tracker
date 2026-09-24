# Architecture

Media Tracker is a single JAR: a Ktor server that hosts a JSON API, a hand-written login page, and the
compiled React single-page app. It runs on a Raspberry Pi and talks to the central MariaDB on that same Pi
(decision record 0018). The documentation index with every feature page and ADR is [index.md](index.md).

## Request flow

```
Browser ──GET /────────────▶ Ktor ── no valid session ──▶ 302 /login
        ◀─ login.html ─────  (public tier: /login, /login/static/*, /health)
        ──POST /login──────▶ AuthService.login ─▶ Argon2id verify ─▶ sessions row ─▶ Set-Cookie MT_SESSION=<signed id>
        ──GET / (+cookie)──▶ DbSessionStorage.read ─▶ UserSession principal ─▶ app/index.html
        ──GET /api/me──────▶ authenticate("session") ─▶ {"username": "..."}
        ──GET /api/games───▶ authenticate("session") ─▶ GameRoutes ─▶ GameService ─▶ ExposedGameRepository ─▶ MariaDB
        ──GET /api/games/cover-options▶ CoverOptionRoutes ─▶ CoverOptionsService ─▶ SteamGridDbCoverSource ─▶ steamgriddb.com
        ──POST /logout─────▶ sessions row deleted, cookie cleared ─▶ 302 /login
Agent   ──POST /mcp (X-API-Key)▶ authenticate("api-key") ─▶ ApiKeyService ─▶ users row ─▶ MCP Server ─▶ tools/call add_game ─▶ GameService
```

Three tiers share one port:

| Tier | Paths | Auth |
|---|---|---|
| Public | `/login` (GET form, POST credentials), `/login/static/*` (CSS), `/logout`, `/health` | none |
| Authenticated | `/` and everything under it (SPA, falls back to `index.html`), `/api/**` | session cookie |
| MCP | `POST /mcp` (Model Context Protocol, stateless Streamable HTTP) | `X-API-Key: <key>` header, or `Authorization: Bearer <key>` |

Unauthenticated requests to `/api/**` and `/mcp` get a JSON `401`; unauthenticated browser navigation is redirected
to `/login`. Both providers live in `auth/api/Security.kt`; `authenticate(name)` only consults the provider named
on that route, so a session cookie never opens `/mcp` and an API key never opens `/api/**` or the SPA.

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

## API keys and MCP

- Each user may hold two API keys (`users.primary_api_key`, `users.secondary_api_key`, nullable `CHAR(36)`
  UUIDs, each `UNIQUE`). They are generated (`Uuid.random()`) and regenerated one slot at a time through
  `POST /api/me/api-keys/{primary|secondary}` and shown in the SPA's settings dialog, hence stored in plaintext.
  Two slots allow rotation: point the client at the second key, then regenerate the first. Decision record 0013.
- `POST /mcp` hosts an MCP server (official Kotlin SDK, stateless Streamable HTTP: JSON responses only, no SSE
  stream, no session id). Every POST gets a fresh `Server` with the tools of all features (`mcp/api/McpEndpoint.kt`,
  root `Routes.kt#mcpRoutes`); a tool call is one HTTP round trip. Tools so far: `list_game_platforms`,
  `add_game` (same fields and optionality as `POST /api/games`), `search_games` (optional `query` plus the four
  optional filter arrays `platformIds`, `ownership`, `progress`, `releaseYears` and the MCP-only `hasMissing`
  (`description`, `coverImageUrl`; a game matches when any listed property is `null`, decision record 0022);
  returns the best matches of `GET /api/games` without paging - `pageSize` many, 10 by default and 100 at most,
  with `totalMatches` and `truncated` alongside them in the structured result; at least one of query or filter is
  required) and `update_game` (the fields of `PATCH /api/games/{id}` plus
  the required `id`, which an agent looks up with `search_games`; only the fields passed are changed;
  `description`, `rating` and `coverImageUrl` accept `null` to clear, every other field rejects an explicit `null`
  rather than silently ignoring it), plus `list_expansions` and `add_expansion` for a game's DLC (both take the `gameId` an agent got from
  `search_games`; `add_expansion` appends), all in `games/api/GameMcpTools.kt`. The `ownership` and `progress` arguments
  advertise their allowed values as a JSON-schema `enum` built from the domain enums, so the tool contract cannot
  drift from the code (decision record 0017). The route encodes
  JSON-RPC replies with the SDK's `McpJson` before the application-wide `ContentNegotiation` sees them (which would
  emit explicit `null`s that MCP clients reject). Clients must send `Accept: application/json, text/event-stream`
  and `Content-Type: application/json`; GET/DELETE answer 405.

## Module map (backend)

```
de.sluit.mediatracker
├── Application.kt      module(): config -> database -> drift warning -> Services -> configureHttp (plugins -> routes)
├── Routes.kt           apiRoutes (meRoutes, apiKeyRoutes + feature routes under the authenticated /api prefix, JSON
│                       404 catch-all), mcpRoutes (API-key-gated /mcp with every feature's tools) and webRoutes
│                       (/health, session-gated SPA from classpath /app)
├── Schema.kt           allTables: every Exposed table object, for the schema drift check
├── config/             AppConfig, DatabaseConfig, SessionConfig, CoverSourceConfig/SteamGridDbConfig (typed
│                       application.yaml; the SteamGridDB key is optional, absent = no cover source)
├── common/             shared code in the same three layers as a feature; knows no feature:
│   ├── api/            shared DTOs (ErrorResponse, HealthResponse, PageResponse<T>; mirrored in
│   │                   frontend/src/types/api.ts), PatchField (+ serializer), Paging (?page/?pageSize parsing),
│   │                   Search (?search parsing)
│   ├── domain/         InvalidValueException/NotFoundException/requireValid,
│   │                   ExternalSourceUnavailableException/ExternalSourceException (an outbound source's
│   │                   503/502, coded by source name), PageNumber/PageSize/PageRequest/Page<T>, Patch<T>, SearchTerm
│   └── persistence/    DatabaseFactory (HikariCP, Flyway migrate, Exposed, drift statements), dbQuery()
├── plugins/            Serialization, Monitoring, StatusPages
├── auth/               CreateUser (bootstrap CLI) plus the same three layers as a media kind:
│   ├── api/            LoginRoutes (/login, /logout), MeRoutes (/api/me), ApiKeyRoutes (/api/me/api-keys) +
│   │                   AuthDtos, Security (SESSION_AUTH + API_KEY_AUTH providers and their challenges,
│   │                   ApiKeyPrincipal), Sessions (cookie + storage plugin), UserSession (principal), DbSessionStorage
│   ├── domain/         AuthService, ApiKeyService, ApiKeys (ApiKey, ApiKeySlot), PasswordHasher (Argon2id),
│   │                   User + UserRepository, StoredSession + SessionRepository
│   └── persistence/    UsersTable, SessionsTable, ExposedUserRepository (+ *Blocking helpers),
│                       ExposedSessionRepository
├── mcp/                technical domain, api layer only, knows no feature:
│   └── api/            McpEndpoint (stateless Streamable HTTP route + McpJson encoding), McpServer (server factory)
└── games/              first media kind (MT-001), the template for Books/Movies/Series (decision record 0007):
    ├── api/            GameDtos (+ DTO <-> domain mappers), GameRoutes (/api/games, /api/games.meta,
    │                   /api/game-platforms), GameFilterParams (the repeatable filter query parameters),
    │                   ExpansionDtos and ExpansionRoutes (/api/games/{id}/expansions, mounted inside the
    │                   game's /{id} block), CoverOptionDtos and CoverOptionRoutes (/api/games/cover-options,
    │                   game-independent), GameMcpTools (MCP tools list_game_platforms, add_game,
    │                   search_games incl. hasMissing and pageSize, update_game, list_expansions, add_expansion)
    ├── domain/         GameValues (GameId, Title, ReleaseYear, Description, Rating, CoverImageUrl,
    │                   GamePlatformId, PlatformLabel, HexColor), GameStatus (Ownership, Progress,
    │                   DEFAULT_HIDDEN), Game/NewGame/GamePatch, GamePlatform, GameFilters (incl. MissingField)/GameMeta,
    │                   GameRepository and GamePlatformRepository (interfaces), GameService,
    │                   Expansion/NewExpansion/ExpansionPatch (ExpansionId, SequenceNumber),
    │                   ExpansionRepository (interface), ExpansionService (owns the dense sequence),
    │                   CoverSource (port: searchGames, findCovers) with CoverSourceGameId/CoverCandidate/
    │                   CoverOption/CoverOptions, CoverMatchRanking (selectBestMatch), CoverOptionsService
    ├── persistence/    GamesTable, GamePlatformsTable, GameToPlatformTable, GameExpansionsTable (Exposed),
    │                   ExposedExpansionRepository, ExposedGameRepository
    │                   (findPage by title, search by fulltext score and filters, findUsedFilterValues),
    │                   FulltextQuery (boolean-mode text),
    │                   FulltextExpressions (MATCH ... AGAINST predicate and weighted score), ExposedGamePlatformRepository
    └── integration/    outbound adapters (decision record 0024): SteamGridDbCoverSource (Ktor client, Java
                        engine) + SteamGridDbDtos (the provider's wire JSON)
```

Layer rule inside a feature: `api -> domain <- persistence`, and `integration -> domain` (plus `config` for its own
settings) for outbound adapters (HTTP clients to third-party services, decision record 0024); the domain imports neither Ktor nor Exposed nor
kotlinx.serialization (pure libraries such as Bouncy Castle or slf4j are fine). Only domain objects and value
classes cross a layer boundary; constructing a value class is the validation. The shared top-level packages
(`common`, `plugins`, `config`) never import a feature package. The files that know every feature live in the
package root (`Application.kt`, `Routes.kt`, `Schema.kt`). Decision record 0010.

## API

All `/api/**` routes need a session cookie; without one they answer `401 {"error":"unauthorized"}`.

| Method and path | Success | Notes |
|---|---|---|
| `GET /api/me` | 200 `{"username"}` | |
| `GET /api/me/api-keys` | 200 `ApiKeysResponse {primary, secondary}` | each a UUID string or `null` |
| `POST /api/me/api-keys/{slot}` | 200 `ApiKeysResponse` | `slot` is `primary` or `secondary` (else 400); replaces that key, the old one stops working at once |
| `GET /api/games?page=1&pageSize=50[&search=zelda][&filters]` | 200 `PageResponse<GameResponse>` | 1-based `page`, `pageSize` 1..200 (default 50); ordered by title; with `search` (trimmed, 1..200 chars, blank = absent) fulltext matches on title and description, games with a title hit first, then by `2 * MATCH(title) + 0.75 * MATCH(description)`, then title, id; every word a prefix term, any word matches (decision record 0015); `totalPages` 0 when empty. Four repeatable filter parameters narrow the result: `platformIds`, `ownership`, `progress`, `releaseYear`; repetitions of one parameter mean "any of", different parameters all have to match, and an unknown value is a 400. Any filter takes the same branch as a search, without a term the title order stays (decision record 0021) |
| `POST /api/games` | 201 `GameResponse` + `Location` | body `CreateGameRequest`: `platformIds` (at least one seeded platform id), `description` (max 10000 chars), `rating` (0.25..5 in quarter steps) and `coverImageUrl` optional; `ownership` (`watchlist`/`owned`, default `watchlist`), `progress` (`not_started`/`playing`/`finished`/`completed`/`paused`/`abandoned`, default `not_started`) and `hidden` (default `false`) optional, an unknown value is a 400 (decision record 0017) |
| `PATCH /api/games/{id}` | 200 `GameResponse` | body `UpdateGameRequest`: omit a field to keep it, `null` clears `description`, `rating` or `coverImageUrl`, `platformIds` replaces the whole set; `ownership`, `progress` and `hidden` cannot be cleared, so an explicit `null` on them means unchanged (as for `title`, `releaseYear` and `platformIds`); 404 for unknown ids |
| `DELETE /api/games/{id}` | 204 | also for unknown ids (idempotent); junction rows go with the game (`ON DELETE CASCADE`) |
| `GET /api/games/{id}/expansions` | 200 `ExpansionResponse[]` | a game's expansions (DLC), ordered by `sequence`, which is dense and zero-based per game; 404 if the game is unknown (decision record 0023) |
| `POST /api/games/{id}/expansions` | 201 `ExpansionResponse` + `Location` | body `CreateExpansionRequest`: `title` required, `ownership` and `progress` optional with the game's own defaults; appended at the end of the order; 404 if the game is unknown |
| `PATCH /api/games/{id}/expansions/{expansionId}` | 200 `ExpansionResponse` | body `UpdateExpansionRequest`: every field optional, `null` never clears (nothing on an expansion is clearable), so no `PatchField`. A `sequence` is a move: the expansion is reinserted at that index and the whole order is renumbered; outside `0..n-1` it is a 400. 404 for an unknown expansion or one belonging to another game |
| `DELETE /api/games/{id}/expansions/{expansionId}` | 204 | idempotent, also for unknown ids; the remaining sequences are re-packed. Deleting the game takes its expansions with it (`ON DELETE CASCADE`) |
| `GET /api/games/cover-options?query=hades[&releaseYear=2020][&match=5245][&type=animated][&page=2]` | 200 `CoverOptionsResponse {query, matches, selectedMatchId, type, covers}` | cover suggestions from SteamGridDB for the cover picker (decision record 0024), independent of any stored game so the add dialog can use it: `matches` are the provider's games for the required search term (`query`, same 1..200 limits as `?search`; missing or blank is a 400), `selectedMatchId` the one the ranking picked (exact title, then the same `releaseYear` when one is given, then first; `null` when nothing matched) and `covers` (`thumbnailUrl`, `imageUrl`, `width`, `height`) only for that one; `match` picks another candidate instead (empty = absent, anything but a positive integer is a 400); `releaseYear` is optional (blank = absent, a non-integer or a year outside 1000..9999 is a 400); `type` is `static` (default) or `animated`, `page` is 1-based (default 1) and `covers` is a `PageResponse` of at most 50 per page in SteamGridDB's score order (`totalItems`/`totalPages` from the provider; `pageSize` is not accepted); an unknown `type`, `page=0` or a non-integer `page` is a 400 naming the field; a page after the first with `match` given skips the upstream search and returns `matches` empty; `503 cover_source_unavailable` when no `STEAMGRIDDB_API_KEY` is configured, `502 cover_source_error` when the provider fails |
| `GET /api/games.meta` | 200 `GameMetaResponse` | the values the four filters can take, and only those that occur in a stored game: `platforms` (`GamePlatformResponse[]`, by label), `ownership` and `progress` (wire strings in the order `GameStatus.kt` declares them), `releaseYears` (descending, newest first). `.meta` is the convention for a resource's lookup data (decision record 0021) |
| `GET /api/game-platforms` | 200 `GamePlatformResponse[]` | seeded reference data (`id`, `label`, `associatedColor` as `RRGGBB`), ordered by label; read-only for now (decision record 0009) |

Errors are `ErrorResponse {error, message?}` with codes `validation_error` (400, a value class rejected a field:
`"title: must not be blank"`), `invalid_body` (400, malformed or ill-typed JSON, missing body), `not_found` (404),
`unauthorized` (401), `method_not_allowed` (405, GET/DELETE on `/mcp`, answered by `mcp/api/McpEndpoint.kt` itself),
`<source>_unavailable` (503, an outbound source such as `cover_source` is not configured) and `<source>_error` (502,
it failed; the upstream status and error list are logged, never returned), `internal_error` (500). The exception mapping lives in `plugins/StatusPages.kt` and also applies to `/mcp`.

`POST /mcp` speaks JSON-RPC 2.0 per the MCP specification (`initialize`, `tools/list`, `tools/call`); authentication
failures are the same JSON `401` plus `WWW-Authenticate: Bearer`. Tool validation failures are returned as tool
results with `isError: true` and the domain message, not as HTTP errors.

## Module map (frontend)

```
frontend/src
├── main.tsx / App.tsx / AppProviders.tsx   i18n init, theme + CssBaseline, shell (AppHeader, MediaTabs, active view)
├── theme/                MUI theme: login-page palette, system font stack; light/dark from the header
│                         toggle (mode.ts: localStorage key mt.mode, default "system" = OS preference)
├── i18n/                 i18next setup, en.json / de.json bundles (typed keys via i18next.d.ts), language storage
├── api/client.ts         apiFetch (401 -> /login, 204 -> undefined, ApiError with the parsed ErrorResponse)
├── types/api.ts          hand-written mirrors of the backend DTOs
├── hooks/                useLocalStorageState, useStoredTab (selected media tab), useDebouncedValue (search fields)
├── components/           shared UI: layout/ (AppHeader, LanguageMenu, ThemeModeToggle, SettingsButton,
│                         LogoutButton, MediaTabs, mediaKinds), dialog/ (BaseDialog, ConfirmDialog,
│                         DialogActionButton), CoverImage (optionally a button, for the cover picker),
│                         ComingSoon
├── features/settings/    UserSettingsDialog (tab bar; "API Keys" tab) + api/ (settingsApi), hooks/ (useApiKeys),
│                         components/ (ApiKeysTab, ApiKeyField: masked read-only key, reveal, copy, regenerate)
├── features/<kind>/      one standalone view per media kind; books, movies, series are "coming soon"
└── features/games/       GamesView (search field + filter bar + pagination bar above the grid) + api/ (gamesApi,
                          ?search and the filter parameters, games.meta, cover-options; expansionsApi), hooks/
                          (useGamesPage, useGamesMeta, useExpansions, useCoverOptions), domain/ (gameValues validators, SEARCH_DEBOUNCE_MS,
                          gameDraft, expansionDraft, gameFilters: the selection and its stable key, gameStatus:
                          ownership/progress values and defaults), components/ (grid, cards, GameSearchField,
                          GameFilterBar, pagination, detail/add dialogs, fields/, ExpansionList/ExpansionCard:
                          the sortable DLC stack inside the detail dialog, ExpansionDialog, CoverPickerDialog:
                          SteamGridDB thumbnails behind the clickable cover of the detail dialog and of the
                          add/edit form (persistence-agnostic: the detail dialog PATCHes the pick, the form
                          fills its URL field), with a static/animated toggle and a load-more button over the
                          paged result;
                          CoverThumbnail: <video> for the WebM clips SteamGridDB uses as animated thumbnails)
```

@dnd-kit (`core`, `sortable`, `utilities`) is the frontend's only runtime dependency beyond React, MUI and
i18next; it drags the expansion cards and its keyboard sensor is what the reorder test drives (decision record
0023).

Browser state: `localStorage["mt.language"]` (`en`/`de`) and `localStorage["mt.mediaTab"]` (`books`/`games`/`movies`/
`series`). The SPA does not call `/api/me` at startup; being served `index.html` already implies a valid session,
and any later 401 redirects to the login page. Decision record 0008 covers the UI stack.

## Build pipeline

```
frontend/src ──pnpm build (Vite 8)──▶ frontend/build/dist ──"frontendDist" variant──▶
backend processResources ──▶ build/resources/main/app/** ──▶ shadowJar ──▶ backend/build/libs/media-tracker.jar
                                     ──Dockerfile (COPY onto gcr.io/distroless/java25-debian13:nonroot)──▶
ghcr.io/slu-it/media-tracker:{latest,sha-<short>}   (master.yml, linux/arm64 + linux/amd64)
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
- The `Dockerfile` never runs Gradle. It copies the finished fat JAR onto the distroless base image as a single
  layer, and `.dockerignore` whitelists exactly that file, so the build context is the JAR alone. The JVM flags
  of `deploy/jvm.options` are baked in as `JAVA_TOOL_OPTIONS`, with the CDS archive at `/tmp/media-tracker.jsa`.
  `pr.yml` builds the image and boots it against a MariaDB container; only `master.yml` pushes, with buildx for
  both architectures (no QEMU, because the image has no `RUN` step). Decision record 0016.

## Runtime on the Pi

- The systemd path: `deploy/media-tracker.service` runs `java @jvm.options -jar media-tracker.jar` as an
  unprivileged user with `Restart=on-failure` and `EnvironmentFile=/etc/media-tracker/env`.
- The container path: `deploy/docker-compose.yml` runs the GHCR image from the same environment file
  (`env_file`) as uid 65532, with a read-only root file system, `cap_drop: ALL`, `no-new-privileges`, a 512 MB
  memory limit and `restart: unless-stopped`. The named volume `cds-archive` at `/tmp` is the only writable
  path and keeps the CDS archive across restarts. The image carries no `HEALTHCHECK`: it has no shell, and
  `/health` remains available for external monitoring. Decision record 0016.
- The database: `deploy/database/docker-compose.yml`, a separate compose project that serves every application
  on the Pi. It publishes no port and owns the Docker network `pi-db`, which the container path joins and
  addresses as `mariadb`; `deploy/database/conf.d/50-tuning.cnf` sizes it for the machine. Databases and their
  owning users come from `deploy/database/create-database.sh`. There is no `depends_on` across compose
  projects: if the application starts first, the pool fails to initialise, the JVM exits and the restart policy
  retries until the database answers. The systemd path cannot resolve `mariadb` and needs the published port
  instead. Decision record 0018.
- `STEAMGRIDDB_API_KEY` is the only optional secret: with it the cover picker queries SteamGridDB through
  `games/integration/SteamGridDbCoverSource` (Ktor client, JDK `HttpClient` engine, 10 s timeout); without it
  the endpoint answers `503 cover_source_unavailable` and the picker says so. Decision record 0024.
- `deploy/jvm.options`: 192 MB heap, SerialGC, C1 only, auto-created CDS archive for faster restarts.
- HikariCP: `maximumPoolSize=3`, `minimumIdle=1`, `keepaliveTime=300000`, `maxLifetime=1500000`. The
  keepalive dates from the web-host era, where idle connections were killed from the other side; against the
  local server it is harmless rather than necessary.
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

- One script per change, named `V<nnn>__<snake_case>.sql`. Strict naming validation is on, so only migration
  files may live in that folder. Never edit a script once it has been applied anywhere; add `V<nnn+1>`.
- Write SQL for MariaDB 11.8; the tests run the same engine in a Testcontainers `mariadb:11.8` (decision record
  0015), so MariaDB-only DDL such as FULLTEXT indexes is fine.
- Timestamp columns are `DATETIME(6)`. V001 still uses the placeholder `${timestamp_type}` from the H2 era; it always
  resolves to `DATETIME(6)` and new scripts do not use it.
- Give foreign-key columns an explicit index in SQL and `.index()` in Kotlin.
- Mirror every change in the Exposed table object in the same commit (`<feature>/persistence/*Table.kt`, e.g.
  `auth/persistence/UsersTable.kt`; every table object is listed in `allTables` in `Schema.kt`, the package
  root). `SchemaDriftTest` fails when scripts and Kotlin tables disagree, and prints the statements
  Exposed would need.
- UUID primary keys are `CHAR(36)` (hex-dash text), not Exposed's `uuid()`; see decision record 0007.
- Reference data that the app needs from day one (the game platforms) is seeded by the migration that creates
  its table, with fixed ids; see decision record 0009. `V002__games.sql` was amended in place once, before the
  first release, under that record; the rule above holds from now on.

## Developer loop

| Goal | Command |
|---|---|
| Everything (lint, format check, tests, fat JAR) | `./gradlew build` |
| Dev loop with live reload (backend + frontend) | `./start-dev.sh`: Docker MariaDB, `:backend:run` in Ktor development mode, `:backend:classes -t`, `pnpm dev`; see decision record 0006 |
| Backend only | `./gradlew :backend:run` (needs `DB_URL`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET` in the environment, optionally `STEAMGRIDDB_API_KEY` for the cover picker; add `-Pmt.dev=true` for auto-reload without the SPA) |
| Frontend hot reload only | `cd frontend && pnpm dev` (proxies `/api`, `/login`, `/logout`, `/health` to `:8080`) |
| Backend tests (handler tests without a database, smoke/repository/drift tests on a Testcontainers MariaDB, needs Docker; ADR 0011, 0015) | `./gradlew :backend:test` |
| Backend coverage report (Kover, informational, decision record 0011) | `./gradlew :backend:koverHtmlReport` |
| Frontend tests (Vitest; writes the V8 coverage report to `frontend/build/coverage/`, informational, decision record 0011; conventions in 0012) | `./gradlew :frontend:pnpmTest` |
| Kotlin style (ktlint, `intellij_idea` style from `.editorconfig`) | `./gradlew :backend:ktlintCheck` / `:backend:ktlintFormat` |
| Frontend lint and format (ESLint, Prettier) | `./gradlew :frontend:pnpmLint :frontend:pnpmFormatCheck` / `:frontend:pnpmFormat :frontend:pnpmLintFix` |
| Release artifact | `./gradlew :backend:buildFatJar` then `backend/build/libs/media-tracker.jar` |

Lint and format checks are part of each project's `check` task, so `./gradlew build` fails on violations. Decision record 0005 explains the tool choice and why detekt is deferred.
