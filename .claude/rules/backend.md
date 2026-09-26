---
paths:
  - "backend/src/main/kotlin/**"
---
# Backend conventions (Ktor, Exposed)

**Packages.** Top-level packages are domains (ADR 0010): business domains (`games`, later books/movies/series),
the technical domain `auth`, and the shared `common` are onion modules `{api,domain,persistence}` (ADR 0007),
dependencies `api -> domain <- persistence`, plus `integration -> domain` (and `config` for its own settings)
for outbound HTTP adapters to third-party services (ADR 0024, `games/integration/`). `mcp` has an `api` layer only
and imports no feature. `common/`, `plugins/` and `config/` never import a feature package. The composition root
is the package root: `Application.kt` (wiring), `Routes.kt` (route mounting), `Schema.kt` (`allTables`,
`backupSources`). `backup` knows only the `BackupSource` and `CloudStorage` ports in `common/domain` and imports no feature (ADR
0027). `dropbox` is a technical domain with all four layers. It imports no feature and not `backup`, which
reaches it only through `CloudStorage` (ADR 0028).
`CreateUser` (bootstrap CLI) sits at the `auth` root.

**Layers.** The domain imports no Ktor, Exposed or kotlinx, except `kotlinx.coroutines` primitives such as
`Mutex` (`DropboxService`'s token cache); kotlinx.serialization stays out. Each layer has its own types (DTOs / entities and
`@JvmInline value class`es / Exposed tables); only domain types cross layers. Value classes validate in `init`
via `requireValid(field, cond) { reason }` -> `InvalidValueException` -> HTTP 400 `validation_error`.
`plugins/StatusPages.kt` also maps `NotFoundException` -> 404, Ktor body failures -> 400 `invalid_body`, and
`ExternalSourceUnavailableException` / `ExternalSourceException` -> 503 `<source>_unavailable` / 502
`<source>_error`. Map every new exception there. `common/domain` holds the framework-free primitives (`Page*`,
`Patch`, `SearchTerm`, exceptions), `common/api` the shared DTOs, paging, `?search` parsing (`Search.kt`) and
`PatchField` (absent / null / value), `common/persistence` HikariCP, Flyway and `dbQuery`.

**Wiring** (`Application.kt`): `module()` does config -> `DatabaseFactory.connect` ->
`DatabaseFactory.warnOnSchemaDrift(database, allTables)` -> `Services(auth, games, apiKeys, expansions,
coverOptions, backup, dropbox, cloudBackup)` from Exposed repositories (and the SteamGridDB and Dropbox HTTP clients
only when their keys are configured) -> `launch { BackupScheduler(...).run() }` on the application scope (ADR
0028) ->
`configureHttp(services, sessionConfig, DbSessionStorage)`. `configureHttp` is everything above the
persistence line: plugins (Serialization, Monitoring, StatusPages, then auth's Sessions and Security) -> routes
(`loginRoutes`, `apiRoutes(services)`, `mcpRoutes(services)`, `webRoutes`). A new media kind adds its service to
`Services` and to `handlerApp` in the tests, and an `ExposedBackupSource` of its tables (parents first) to
`backupSources`. Config is typed in `config/AppConfig.kt` from `application.yaml`,
where every secret is an env-var reference (`"$VAR"` required, `"$VAR:default"` optional). Shutdown hooks in
`module()` hang off the application's coroutine job, never `monitor.subscribe(ApplicationStopped)`: with
auto-reload the new instance starts before the old one stops and would close the new instance's resources.

**Routes and auth tiers.** Public: `/login`, `/login/static/*`, `/logout`, `/health`. The SPA (with `index.html`
fallback) and everything under `/api` sit inside `authenticate(SESSION_AUTH)`; `POST /mcp` sits inside
`authenticate(API_KEY_AUTH)` (`X-API-Key: <key>`, alias `Authorization: Bearer <key>`). Both providers and their
challenges live in `auth/api/Security.kt`: JSON 401 for `/api` and `/mcp`, a 302 to `/login` otherwise.
`authenticate(name)` consults only the named provider. Each feature defines `Route.<kind>Routes(service)` in
`<feature>/api/*Routes.kt`; `apiRoutes` in the root `Routes.kt` mounts it inside that `authenticate` block,
before the `{...}` catch-all that turns unknown API paths into JSON 404s. Sub-resources nest inside the parent's
`/{id}` block (`games/api/ExpansionRoutes.kt`). Sessions live in the `sessions` table; the `MT_SESSION` cookie
holds only an HMAC-signed id; `DbSessionStorage` rebuilds the principal per request. Passwords are Argon2id PHC
strings (`auth/domain/PasswordHasher.kt`).

**Database access.** Exposed 1.5 with `org.jetbrains.exposed.v1.*` package roots; timestamps are
`kotlin.time.Instant`. JDBC is blocking, so route and service code reaches the database only through
`dbQuery { }` (`common/persistence/DatabaseFactory.kt`, runs on `Dispatchers.IO`). Repository interfaces live in
the feature's `domain`; Exposed implementations additionally expose `*Blocking` variants for use inside an
existing transaction (tests, `CreateUser`). Schema rules are in `schema-migrations.md`.

**DTOs.** `@Serializable` DTOs in `common/api/Dtos.kt` and `<feature>/api/*Dtos.kt` are hand-mirrored in
`frontend/src/types/api.ts`; change both together. Enum-like fields use the enum's `wire` value
(`name.lowercase()`, ADR 0017) in the column, the DTO and the MCP schema alike.

**MCP** (`mcp/api/McpEndpoint.kt`, ADR 0013): stateless Streamable HTTP, a fresh SDK `Server` per POST, built
from the SDK's public transport pieces because its `mcpStreamableHttp` helpers open their own `routing {}` and
cannot sit inside `authenticate`. Replies are pre-encoded with the SDK's `McpJson` in an
`ApplicationSendPipeline.Before` interceptor; never let them reach the app-wide `ContentNegotiation`
(`explicitNulls` would emit `"isError": null` and break clients), and never switch the global Json to
`explicitNulls = false` (drops REST `null`s the TS types mirror). Tools live in the owning feature
(`<kind>/api/<Kind>McpTools.kt`, `fun Server.add<Kind>Tools(service)`), are registered in the root
`Routes.kt#mcpRoutes`, reuse the REST request DTO and its `toNew<Kind>()` mapper, and turn domain exceptions
into `CallToolResult(isError = true)`. Reject empty or unknown arguments explicitly; `McpJson` swallows them.
Requests need `Accept: application/json, text/event-stream` and `Content-Type: application/json`.

**KDoc gotcha.** `/api/**` inside a KDoc opens a nested comment and breaks compilation; write "under `/api`".
