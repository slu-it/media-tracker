# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Self-hosted media-list tracker: one fat JAR (Ktor backend + compiled React SPA + hand-written login page)
running on a Raspberry Pi (systemd unit or docker compose, ADR 0016) against a remote MariaDB 11.8. Two Gradle
projects, `backend` and `frontend`; Gradle is the only tool you need installed besides JDK 25 (Node 24 and pnpm 10
are downloaded by Gradle).

Phase 1 (build, login gate, sessions) is done. Phase 2 is the media domain, one media kind at a time: Games
(MT-001: title, year, optional description and quarter-step rating, many-to-many platforms from a seeded
`game_platforms` table, ADR 0009) is implemented end to end (`backend/.../games/`, `frontend/src/features/games/`)
and is the template for Books, Movies and Series, which are "coming soon" tabs
(`frontend/src/features/{books,movies,series}/`). MT-002 added per-user API keys (two slots, settings dialog in
`frontend/src/features/settings/`) and an MCP server at `POST /mcp` (ADR 0013) whose tools each feature contributes
(`games/api/GameMcpTools.kt`: `list_game_platforms`, `add_game`, `search_games`). MT-003 added fulltext search over
title and description (`GET /api/games?search=`, debounced field above the games grid, MCP tool `search_games`;
ADR 0015: MariaDB FULLTEXT; the same ADR replaced H2 with a Testcontainers MariaDB for every backend test, so Docker
is a development requirement).

Detailed docs already exist and are kept current; read them before larger changes:
`README.md` (setup/run), `docs/architecture.md` (request flow, module map, build pipeline, migration
rules), `docs/decisions/000N-*.md` (ADRs). Add a new numbered ADR for any decision of similar weight.
`tmp/` is gitignored scratch (contains the original project description).

## Commands

| Goal | Command |
|---|---|
| Everything: both projects, lint, format checks, all tests, fat JAR | `./gradlew build` |
| Backend tests (needs Docker: one Testcontainers `mariadb:11.8` per test JVM, never skipped) | `./gradlew :backend:test` |
| One backend test class | `./gradlew :backend:test --tests 'de.sluit.mediatracker.ApplicationSmokeTest'` |
| One backend test method (backtick names, quote them) | `./gradlew :backend:test --tests 'de.sluit.mediatracker.auth.api.AuthRoutesTest.anonymous api call gets json 401'` |
| Backend coverage report (Kover, also written by every `build`/`check`; no threshold) | `./gradlew :backend:koverHtmlReport`, then open `backend/build/reports/kover/html/index.html` |
| Frontend tests (Vitest; also writes the V8 coverage report, no threshold) | `./gradlew :frontend:pnpmTest` or `cd frontend && pnpm test`, then open `frontend/build/coverage/index.html`. The Gradle task is up-to-date-checked like `:backend:test`; `--rerun-tasks` forces a rerun |
| One frontend test file | `cd frontend && pnpm vitest run src/App.test.tsx` |
| Frontend type-check only | `cd frontend && pnpm typecheck` (`pnpm build` runs `tsc -b` first) |
| Kotlin lint / auto-format | `./gradlew :backend:ktlintCheck` / `./gradlew :backend:ktlintFormat` |
| Frontend lint / format | `cd frontend && pnpm lint` / `pnpm format:check`; fix with `pnpm lint:fix` / `pnpm format` (Gradle: `:frontend:pnpmLint`, `pnpmFormatCheck`, `pnpmLintFix`, `pnpmFormat`) |
| Dev loop with live reload (backend auto-reload + Vite HMR) | `./start-dev.sh` (Docker MariaDB, `:backend:run -Pmt.dev=true`, `:backend:classes -t -Pmt.dev=true`, `pnpm dev`; open :5173) |
| Backend dev run (serves last built frontend) | `./gradlew :backend:run` (needs `DB_URL`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET`) |
| Frontend hot reload | `cd frontend && pnpm dev` (port 5173, proxies `/api`, `/login`, `/logout`, `/health` to `:8080`) |
| Full local end-to-end (production-like JAR) | `./build-and-start-locally.sh` (starts Docker MariaDB, builds, ensures user `slu`, runs on :8080); `MT_SKIP_BUILD=1` reuses the last JAR. Shared env/helpers in `local-env.sh` |
| Release JAR | `./gradlew :backend:buildFatJar` then `backend/build/libs/media-tracker.jar` |
| Container image (JAR first; single-arch for the host, local testing only) | `./gradlew :backend:buildFatJar && docker build -t media-tracker:local .` |
| Run that image against the local MariaDB | `source local-env.sh && docker compose up -d --wait mariadb && docker run --rm --network host -e DB_URL -e DB_USER -e DB_PASSWORD -e SESSION_SECRET -e SESSION_SECURE media-tracker:local` |
| Create/reset a user (no self-registration) | `java -cp backend/build/libs/media-tracker.jar de.sluit.mediatracker.auth.CreateUser <name> [--reset-password]` |

**Lint and format checks fail the build.** `./gradlew build` runs ktlint (`:backend:ktlintCheck`), ESLint
(`:frontend:pnpmLint`) and a Prettier check (`:frontend:pnpmFormatCheck`) via each project's `check` task.
Before committing, auto-fix with `./gradlew :backend:ktlintFormat` and `cd frontend && pnpm format && pnpm lint:fix`.
ktlint uses the `intellij_idea` code style from `.editorconfig` (4 spaces, 120 columns) with `no-unused-imports`
explicitly enabled (it is off by default in ktlint 1.x); Prettier uses
`printWidth: 120` with 2-space indentation. ESLint config is `frontend/eslint.config.js` (flat config,
typescript-eslint non-type-aware recommended, react-hooks, react-refresh, eslint-config-prettier).
detekt is intentionally absent until detekt 2.0 (Kotlin 2.4 support) is GA, see `docs/decisions/0005-linting.md`.
The ktlint plugin is only applied in `:backend`; the root and frontend Gradle scripts are not linted by the build.

**CI.** `.github/workflows/pr.yml` (pull requests to `master`) and `master.yml` (push to `master`) both run
`./gradlew build` on JDK 25 with Gradle and Node/pnpm caches; `master.yml` uploads `backend/build/libs/media-tracker.jar`
as the `media-tracker-jar` artifact. pnpm runs with a frozen lockfile in CI, so commit `pnpm-lock.yaml` changes.
CI passes `--max-workers=2` to Gradle and Vitest caps itself to 3 workers when `CI` is set (few-core hosted runner,
backend build and frontend tests overlap); locally both use their core-based defaults.
`master.yml` additionally builds the root `Dockerfile` (one `COPY` of the JAR onto
`gcr.io/distroless/java25-debian13:nonroot`) with buildx for linux/arm64+amd64 and pushes
`ghcr.io/slu-it/media-tracker:{latest,sha-<short>}` (`permissions: packages: write`, `GITHUB_TOKEN`); `pr.yml` only
`docker build`s it and boots it against the root-compose MariaDB (`/health`). Never publish from `pr.yml`. The JVM
flags live as `JAVA_TOOL_OPTIONS` in the Dockerfile and are mirrored from `deploy/jvm.options`: change both.
Pi deployment via `deploy/docker-compose.yml` is documented in the README next to the systemd path (ADR 0016).

Gradle runs with configuration cache, build cache and parallel on. `frontend/build.gradle.kts` must keep
`node.version` and `pnpmVersion` as literal strings (node-gradle 7.1.0 configuration-cache bug).

## Architecture essentials

**Frontend → backend handoff.** `:frontend` exposes Vite's output (`frontend/build/dist`) as a consumable
Gradle configuration `frontendDist`; `:backend` resolves it as a dependency and copies it into
`build/resources/main/app/` during `processResources`. Never reference `:frontend` tasks from `:backend`,
and never write into `backend/src/main/resources/app/` (gitignored, must stay empty).
`-Pmt.dev=true` drops that copy and puts `run` into Ktor development mode (dev loop only, Vite serves the SPA);
never pass it to `build`/`buildFatJar`.
Shutdown hooks in `module()` must hang off the application's coroutine job, not `monitor.subscribe(ApplicationStopped)`:
with Ktor auto-reload the new instance starts before the old one stops and would close the new instance's resources.

**Backend wiring** (`Application.kt`): `module()` does config → `DatabaseFactory.connect` →
`DatabaseFactory.warnOnSchemaDrift(database, allTables)` → `Services(auth, games, apiKeys)` from Exposed
repositories → `configureHttp(services, sessionConfig, DbSessionStorage)`. `configureHttp` is everything above the
persistence line: plugins (Serialization, Monitoring, StatusPages, then auth's Sessions and Security) → routes
(`loginRoutes`, `apiRoutes(services)`, `mcpRoutes(services)`, `webRoutes`). Handler tests boot `configureHttp` with
MockK services (`handlerApp(auth, games, apiKeys)`) and an in-memory session storage; a new media kind adds its
service to `Services`.
Config is typed in `config/AppConfig.kt` from `application.yaml`, where every secret is an env-var reference
(`"$VAR"` required, `"$VAR:default"` optional).

**Top-level packages are domains** (ADR 0010): business domains (`games`, later books/movies/series), the
technical domain `auth` and the shared `common` are onion modules `{api,domain,persistence}`; `CreateUser`
(bootstrap CLI) sits at the `auth` root. `mcp` is a technical domain with an `api` layer only (`McpEndpoint`,
`McpServer`) and imports no feature; the root `Routes.kt#mcpRoutes` is what registers every feature's tools.
`common/domain` holds framework-free primitives (`Page*`, `Patch`, `SearchTerm`, exceptions), `common/api` the shared
DTOs, paging, `?search` parsing (`Search.kt`) and `PatchField`, `common/persistence` HikariCP/Flyway/`dbQuery`.
`common/`, `plugins/` (Serialization, Monitoring, StatusPages) and `config/` never import a feature package. The
composition root is the package root: `Application.kt` (wiring), `Routes.kt` (`apiRoutes` mounts `meRoutes()`,
`apiKeyRoutes()` and `gameRoutes()` under the authenticated `/api` prefix with the JSON 404 catch-all; `mcpRoutes`
mounts the MCP endpoint under `authenticate(API_KEY_AUTH)`; `webRoutes` serves `/health` and the session-gated SPA)
and `Schema.kt` (`allTables`).

**Three auth tiers on one port.** Public: `/login`, `/login/static/*`, `/logout`, `/health`. The SPA (with
`index.html` fallback) and `/api/**` sit inside `authenticate(SESSION_AUTH)`; `POST /mcp` sits inside
`authenticate(API_KEY_AUTH)` (header `X-API-Key: <key>`, alias `Authorization: Bearer <key>`). Both providers and
their challenges live in `auth/api/Security.kt`: JSON 401 for `/api/*` and `/mcp`, a 302 to `/login` otherwise.
`authenticate(name)` only consults the named provider, so cookies never open `/mcp` and keys never open `/api`.
`/api/me` is `auth/api/MeRoutes.kt`; `/api/me/api-keys` (GET, `POST /{primary|secondary}`) is `auth/api/ApiKeyRoutes.kt`,
backed by `auth/domain/ApiKeyService` over two nullable unique `CHAR(36)` columns on `users` (V3). `apiRoutes` ends
with a `{...}` catch-all so unknown API paths are JSON 404s instead of the SPA. Each feature defines its routes
in `<feature>/api/*Routes.kt` (`Route.gameRoutes(service)`) and `apiRoutes` in the root `Routes.kt` mounts them
inside that `authenticate` block, before the catch-all.

**Feature packages are onion-layered** (ADR 0007): `de.sluit.mediatracker.<feature>.{api,domain,persistence}`,
dependencies `api → domain ← persistence`, the domain imports no Ktor/Exposed/kotlinx. Each layer has its own types
(DTOs / entities + `@JvmInline value class`es / Exposed tables); only domain types cross layers. Value classes
validate in `init` via `requireValid(field, cond) { reason }` → `InvalidValueException` → HTTP 400
`validation_error` (`plugins/StatusPages.kt` also maps `NotFoundException` → 404, Ktor body failures → 400
`invalid_body`). Shared primitives (`Page*`, `Patch`, exceptions) live in `common/domain`; optional PATCH fields use
`common/api/PatchField.kt` (absent / null / value). Copy the `games` package for the next media kind; `auth` follows the
same three layers (`AuthService.login` returns the domain `User`, `auth/api/LoginRoutes.kt` maps it to `UserSession`).

**Sessions** live in the `sessions` table; the cookie `MT_SESSION` holds only an HMAC-signed id.
`DbSessionStorage` rebuilds the `UserSession` principal per request and lazily deletes expired rows.
Passwords are Argon2id PHC strings (`auth/domain/PasswordHasher.kt`).

**MCP endpoint** (`mcp/api/McpEndpoint.kt`, ADR 0013): stateless Streamable HTTP, a fresh SDK `Server` per POST,
built by hand from the SDK's public transport pieces because the SDK's `mcpStreamableHttp` helpers open their own
`routing {}` and cannot sit inside `authenticate`. The route pre-encodes JSON-RPC replies with the SDK's `McpJson`
in an `ApplicationSendPipeline.Before` interceptor; never let them reach the app-wide `ContentNegotiation`
(`explicitNulls` would emit `"isError": null` and break clients), and never switch the global Json to
`explicitNulls = false` (drops REST `null`s the TS types mirror). Tools live in the owning feature
(`<kind>/api/<Kind>McpTools.kt`, `fun Server.add<Kind>Tools(service)`), reuse the REST request DTO and its
`toNew<Kind>()` mapper, and turn domain exceptions into `CallToolResult(isError = true)`. Requests need
`Accept: application/json, text/event-stream` and `Content-Type: application/json` (SDK returns 406/415 otherwise).

**Database access.** Exposed 1.5 with `org.jetbrains.exposed.v1.*` package roots; timestamps are
`kotlin.time.Instant`. JDBC is blocking, so route code must call `dbQuery { }`
(`common/persistence/DatabaseFactory.kt`), which runs the transaction on `Dispatchers.IO`. Repository interfaces
live in a feature's `domain`; the Exposed
implementations (`auth/persistence/ExposedUserRepository`) additionally expose `*Blocking` variants for use inside
an existing transaction (tests, `CreateUser`).

**Schema changes are a two-file commit.** Flyway SQL in `backend/src/main/resources/db/migration/` is
the source of truth; an Exposed table object mirrors it (`<feature>/persistence/*Table.kt`, e.g.
`auth/persistence/UsersTable.kt`, `games/persistence/GamesTable.kt`) and must be listed in `allTables` in
`Schema.kt` (package root). `SchemaDriftTest` compares the migrated test MariaDB with the Kotlin tables and fails
if Exposed would still want to change anything. Rules:
- Name scripts `V<nnn>__<snake_case>.sql`; never edit an applied script, add `V<nnn+1>`.
- SQL targets MariaDB 11.8 only (the tests run the same engine, ADR 0015). Timestamp columns are `DATETIME(6)`;
  the `${timestamp_type}` placeholder in V001 is a leftover from the H2 era and always resolves to `DATETIME(6)`.
- Every FK column gets an explicit `INDEX` in SQL and `.index()` in Kotlin, or the drift test fails.
- Declare every index on the table object (`index(name, false, cols, indexType = "FULLTEXT")` for fulltext); Exposed
  compares indexes by name, columns and uniqueness and treats two indexes over the identical column list as excess,
  hence `idx_games_title (title, id)` next to the fulltext `ft_games_title (title)`.
- Migrations run at startup; the app never alters the schema itself.
- UUID ids are `CHAR(36)` text (Exposed `char("id", 36)`), never `uuid()`.

**DTO mirroring.** `@Serializable` DTOs in `backend/.../common/api/Dtos.kt` (shared) and
`backend/.../<feature>/api/*Dtos.kt` (`auth/api/AuthDtos.kt` incl. `ApiKeysResponse`, `games/api/GameDtos.kt`) are
hand-mirrored in `frontend/src/types/api.ts`. Change both together. `frontend/src/api/client.ts` (`apiFetch`)
redirects to `/login` on 401, resolves `undefined` for 204, and throws `ApiError` (with the parsed `ErrorResponse`
as `body`) on other non-2xx.

**Frontend stack** (ADR 0008): MUI 9 (`sx` prop, `slotProps.*`, icons imported by path `@mui/icons-material/<Name>`;
the barrel import is an ESLint error), theme in `src/theme/theme.ts` (no `index.css`), i18next with typed keys: every
UI string goes through `t()` and must exist in both `src/i18n/en.json` and `de.json` (a test compares key sets;
platform labels come from the database via `/api/game-platforms`, not from the bundles). Hooks/constants/validators
live in non-component files (react-refresh rule). Feature layout `src/features/<kind>/{api,domain,hooks,components}`
+ `<Kind>View.tsx`; domain constraints are mirrored as validators returning i18n codes and wrapped in
self-validating field components. Common dialogs: `components/dialog/BaseDialog` (round protruding close button,
optional left action column with top and bottom slots, optional fixed height) and `ConfirmDialog`.
The frontend sends `pageSize=50` explicitly (`GAMES_PAGE_SIZE`), matching the backend default. The games search field
debounces through `src/hooks/useDebouncedValue.ts` (`SEARCH_DEBOUNCE_MS`, 1 s), `listGames` appends `search=` only
when non-blank, and `GamesView` derives the page-1 reset from state (`paging.search === debouncedSearch`) instead of
an effect: the react-hooks preset in `eslint.config.js` makes `set-state-in-effect` an error.

**Backend tests** (levels and rules in ADR 0011; one behaviour per method, backtick names that read as a sentence,
no `. / < > : [ ] ; \`). Domain unit tests (no framework); service unit tests with MockK (`coEvery`/`coVerify` on
the repository interfaces); repository tests via `withFreshDatabase {}` / `countStatements {}`
(`test/.../common/persistence/TestDatabase.kt`: one Testcontainers `mariadb:11.8` and one migrated database
`media_tracker_test` per test JVM, `withFreshDatabase` truncates every table in `allTables` except the seeded
`game_platforms` first, and Exposed's default database is pinned to that shared pool; Docker is required, nothing is
skipped without it); **handler tests** (`<feature>/api/<Feature>RoutesTest`,
`auth/api/AuthRoutesTest`, root `RoutesTest`) through `testApplication` + `handlerApp(auth, games, apiKeys)` from
`test/.../TestApp.kt`, which boots `configureHttp` with MockK services and `SessionStorageMemory`, no database
(`loginAsMocked(auth)` logs in through the real `/login`); they own status codes, headers, (de)serialization,
`PatchField` mapping (`coVerify` the domain value the service receives) and every negative path; **smoke tests**
(`<feature>/<Feature>SmokeTest`, root `ApplicationSmokeTest`) through `testApplication` + `appWithUser` (real
`module()` on the shared test MariaDB, `application-test.yaml` merged with the container coordinates, cheap `PasswordHasher(memoryKb = 1024, iterations = 1)`
for the seeded user, `loginAs`, `decodeBody`, `jsonBody`), happy paths only, at least one valid request per
operation; and infrastructure edge cases (`DbSessionStorage`, `StatusPages` in an isolated app, `AppConfig` via
`MapApplicationConfig`, `CreateUser.run()`). MCP handler tests (`mcp/api/McpRoutesTest`) post raw JSON-RPC with the two
headers named above; the smoke test (`mcp/McpSmokeTest`) drives the real module through the SDK's `kotlin-sdk-client`.
Mocks only above the repository interfaces (services in handler
tests, repositories in service tests). The shared test database survives between tests in a JVM, so seed idempotently
or clean up (`GamesTable.deleteAll()`); `appWithUser` upserts its user's password hash because repository tests may
have inserted the same username with a fake hash. Kover writes `backend/build/reports/kover/html/index.html` on every `build`; coverage
is informational, there is no threshold. Frontend tests use Vitest + Testing Library + user-event with
MUI rendered in jsdom (`pnpm test` runs `vitest run --coverage`; the V8 report lands in `frontend/build/coverage/`,
also informational): `src/test/renderWithProviders.tsx` and `src/test/mockFetch.ts` (`mockApi({"GET /api/games": ...})`
records calls; an unmocked request throws); any `console.error` during a test fails it; shared fixtures live in
`src/test/fixtures/`; dialogs are portals, query via `screen`; open MUI selects with `user.click` on the combobox.
Enter multi-character text with `user.click(field)` then `user.paste("...")`; per-keystroke `user.type` is ~10x slower and
hit the CI timeout, keep it for single characters whose keystroke behaviour is under test.
Vitest runs with `testTimeout: 10_000` and `isolate: false` (one jsdom shared across files; `test-setup.ts` runs per
file and does the lifecycle itself: explicit `afterEach(cleanup)`, a `beforeAll` setting `IS_REACT_ACT_ENVIRONMENT`, then
mocks, language and `localStorage`; never rely on state from another file and never remove those hooks). Conventions and known
jsdom limits (MUI Rating clicks) are in ADR 0012.

## Version policy

`gradle/libs.versions.toml` is the single source for JVM versions; npm packages are pinned exactly in
`frontend/package.json` (no `^` ranges). Stay on the current majors and take the newest release within
each (current: MUI 9, Emotion 11, i18next 26, react-i18next 17 on the npm side); do not bump majors
(e.g. pnpm 12, TypeScript 7, Logback 1.6) without asking. `@vitest/coverage-v8` declares the exact Vitest version as
a peer dependency, so bump it together with `vitest` to the same version.

## Git
- Never commit, amend or push on your own. The owner decides how, when and how often to commit; finish a work
  package with a verified working tree and a summary, and commit only when explicitly asked, in the form asked.

## Delegation
- Main session: planning, decisions, synthesis. Do not read whole files or run tests directly.
- Use Explore for any codebase search, implementer for scoped edits, test-runner for verification, reviewer before finishing
  (definitions in `.claude/agents/`).
- Prefer several parallel subagents for independent investigations, but only one subagent that runs Gradle at a time:
  concurrent Gradle invocations contend on the daemon lock and the configuration cache.
