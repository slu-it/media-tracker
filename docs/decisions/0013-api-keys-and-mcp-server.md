# 0013: Per-user API keys and a stateless MCP server behind them

Status: accepted, 2026-09

## Context

Until now the only way into the tracker was the session-gated SPA and its `/api` JSON routes. The owner wants any
agent that speaks the Model Context Protocol (MCP) to be able to fill the collection, starting with games. That
needs a second credential type that a machine can hold (browser sessions and the login form do not fit an agent),
a way for the user to create, see, copy and rotate that credential, and an MCP endpoint that accepts it.

The official Kotlin MCP SDK (`io.modelcontextprotocol:kotlin-sdk-server`, 0.15.0, built on Ktor 3.5.1) ships Ktor
helpers (`mcpStreamableHttp`, `mcpStatelessStreamableHttp`), but they open their own `routing {}` block and install
their own `ContentNegotiation`, so they cannot be nested inside our `authenticate {}` and they collide with the
application-wide JSON configuration.

## Decision

- **Two plaintext UUID keys per user.** `users.primary_api_key` and `users.secondary_api_key`, `CHAR(36)` nullable,
  each with a `UNIQUE` constraint (V3). The keys are stored in plaintext because the UI must show and copy them at
  any time; a UUID v4 (`kotlin.uuid.Uuid.random()`, SecureRandom-backed) carries 122 random bits and is looked up by
  indexed equality, so hashing would only protect against a database leak, at the price of "show once" UX. Two
  slots make rotation possible without downtime: switch the client to the second key, then regenerate the first.
  Revoking a key without replacing it is not offered yet (regenerate replaces it).
- **Keys are an `auth` concern.** `auth/domain/ApiKeys.kt` (`ApiKey`, `ApiKeySlot`, `ApiKeys`), `ApiKeyService`
  (`keysFor`, `regenerate`, `authenticate`), `UserRepository.{findApiKeys,saveApiKey,findByApiKey}`; REST under the
  session tier: `GET /api/me/api-keys`, `POST /api/me/api-keys/{primary|secondary}` (`auth/api/ApiKeyRoutes.kt`).
- **Third auth tier on the same port.** `auth/api/Security.kt` registers a second Ktor authentication provider,
  `API_KEY_AUTH`, built with Ktor's public `provider(name) { authenticate { } }` API. It reads `X-API-Key: <key>`
  (documented, the de-facto convention for key headers) and, as an alias for MCP clients that can only send OAuth
  style headers, `Authorization: Bearer <key>`. Failure is a JSON 401 with `WWW-Authenticate: Bearer`. Tiers are
  structurally separate: `authenticate(name)` only consults the providers named on that route, so a session cookie
  never authenticates `/mcp` and an API key never authenticates `/api/**` or the SPA.
- **Stateless Streamable HTTP, one server per request, our own route.** `mcp/api/McpEndpoint.kt` mounts
  `POST /mcp` inside `authenticate(API_KEY_AUTH)` and replicates the SDK's private stateless endpoint with its
  public building blocks: `StreamableHttpServerTransport(Configuration(enableJsonResponse = true))` without a
  session id generator, `server.createSession(transport)`, `transport.handleRequest(null, call)`, close the session
  in `finally`. GET and DELETE answer 405. No SSE stream, no resumability, no session registry: an agent adding a
  game needs none of that, and the Raspberry Pi keeps no per-client state. DNS-rebinding/Host validation, which the
  SDK helper enables for localhost by default, is off: the Pi is reached by hostname and the endpoint is key-gated.
- **`McpJson` on the wire.** In JSON-response mode the transport answers with `call.respond(jsonRpcMessage)`,
  which runs through Ktor `ContentNegotiation`. The SDK requires its `McpJson` (`explicitNulls = false`,
  `classDiscriminatorMode = NONE`); our application Json would emit `"isError": null` and break clients.
  `ContentNegotiation` transforms in `ApplicationSendPipeline.Transform`, and application-level interceptors run
  before route-level ones within a phase, so a route-scoped `json(McpJson)` would lose. The `/mcp` route therefore
  intercepts `sendPipeline` at `ApplicationSendPipeline.Before` and encodes `JSONRPCMessage` (and batches) with
  `McpJson` into `TextContent`, which the global converter passes through untouched.
- **Tools live in the owning feature.** `games/api/GameMcpTools.kt` (`Server.addGameTools(gameService)`) registers
  `list_game_platforms` and `add_game`, exactly as `games/api/GameRoutes.kt` contributes the REST routes. `add_game`
  reuses `CreateGameRequest` and `toNewGame()`, so the MCP input has the same fields and optionality as
  `POST /api/games`; domain validation failures become `isError` tool results with the domain message. The root
  `Routes.kt` (`mcpRoutes`) is the only place that knows every feature's tools. `mcp` is a technical domain with
  an `api` layer only (transport glue, server factory), importing no feature.
- **Frontend.** `features/settings/` with `UserSettingsDialog` (tab bar, one tab "API Keys"), `ApiKeysTab` and the
  `ApiKeyField` row (masked read-only field with reveal, copy, regenerate with confirmation when a key exists).
  The field is a masked text field, not `type="password"`, so browsers do not offer to save the key.

## Alternatives not taken

- SDK helpers `mcpStreamableHttp`/`mcpStatelessStreamableHttp`: cannot sit inside `authenticate`, and their
  `installMcpContentNegotiation` only warns when another `ContentNegotiation` exists.
- Switching the global Json to `explicitNulls = false`: would silently drop `null` fields from the REST API that
  `frontend/src/types/api.ts` mirrors as `string | null`.
- A first-registered `ContentConverter` for JSON-RPC types in `plugins/Serialization.kt`: works, but `plugins`
  knows no domain or third-party protocol types (ADR 0010).
- Hashed keys shown once: safer at rest, but the owner wants keys visible and copyable in the settings dialog.
- Stateful Streamable HTTP with SSE streams: needed only for server-initiated notifications and resumable streams.
- Ktor's built-in `bearer` provider: its challenge is a body-less 401, we want the JSON `ErrorResponse`.

## Consequences

- Handler tests boot `configureHttp` with `Services(auth, games, apiKeys)`; `handlerApp(auth, games, apiKeys)`.
- A new media kind adds `<kind>/api/<Kind>McpTools.kt` and one `add<Kind>Tools(...)` line in `mcpRoutes`.
- `plugins/StatusPages.kt` treats `/mcp` like `/api/*` (JSON errors).
- Rotation procedure for the owner: generate the secondary key, move the client to it, regenerate the primary.
