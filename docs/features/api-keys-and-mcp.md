# API keys and MCP server (MT-002)

ADR: [0013](../decisions/0013-api-keys-and-mcp-server.md). Code: `auth/api/ApiKeyRoutes.kt`,
`auth/domain/ApiKeyService.kt`, `mcp/api/`, `<kind>/api/<Kind>McpTools.kt`, `frontend/src/features/settings/`.
Connecting an agent as a client is described in the README section "MCP server".

## API keys

- Two slots per user, `primary` and `secondary`, as plaintext UUIDs in two nullable unique `CHAR(36)` columns
  on `users` (V003). `GET /api/me/api-keys` shows them, `POST /api/me/api-keys/{primary|secondary}` regenerates
  one slot; the settings dialog confirms before regenerating. Two slots allow rotation without downtime.
- A key opens only `POST /mcp` (`X-API-Key: <key>`, alias `Authorization: Bearer <key>`). Session cookies never
  open `/mcp`, keys never open `/api`.

## MCP server

- `POST /mcp` is stateless Streamable HTTP with a fresh SDK `Server` per request. How the endpoint is built and
  its JSON rules are in `.claude/rules/backend.md`.
- Tools, each owned by its feature:
  - `list_game_platforms`, `add_game` (MT-002).
  - `search_games` (MT-003), with the REST filters, `hasMissing` and `pageSize` from later tickets
    ([search and filters](game-search-and-filters.md)).
  - `update_game`: one flow with `search_games`. Search by title for the id, then patch only the fields passed;
    `null` clears a clearable field; empty or unknown arguments are rejected explicitly because `McpJson` would
    otherwise swallow them silently.
  - `list_expansions`, `add_expansion` (MT-016, [expansions](game-expansions.md)).
- Tools reuse the REST request DTOs and their `toNew<Kind>()` mappers and turn domain exceptions into
  `CallToolResult(isError = true)`.
