# API keys and MCP server (MT-002)

ADR: [0013](../decisions/0013-api-keys-and-mcp-server.md). Code: `auth/api/ApiKeyRoutes.kt`,
`auth/domain/ApiKeyService.kt`, `mcp/api/`, `<kind>/api/<Kind>McpTools.kt`, `frontend/src/features/settings/`.
Connecting an agent as a client is described in the README section "MCP server".

## API keys

- Two slots per user, `primary` and `secondary`, as plaintext UUIDs in two nullable unique `CHAR(36)` columns
  on `users` (V003). `GET /api/me/api-keys` shows them, `POST /api/me/api-keys/{primary|secondary}` regenerates
  one slot; the settings dialog (API keys tab, after the Password tab) confirms before regenerating. Two slots
  allow rotation without downtime.
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
  - `search_game_developers`, `create_game_developer` (MT-025, [release date and developers](game-release-date-and-developers.md));
    `add_game`/`update_game` take `releaseDate` and `developerIds`.
  - `find_game_cover` (`title` required, `releaseYear` optional): the first static SteamGridDB cover of the
    best-ranked match plus that match, for `coverImageUrl` in `update_game`/`add_game`
    ([cover picker](cover-picker.md)). Registered only when `STEAMGRIDDB_API_KEY` is set.
  - `list_book_types`, `add_book`, `search_books`, `update_book`, `search_book_authors`, `create_book_author`
    (MT-041, [books](books.md)), plus `search_book_narrators`, `create_book_narrator`, `search_book_series` and
    `create_book_series` (MT-042, ADR 0035): the game flows for books, without sort, rating, expansions or covers. `add_book`
    and `update_book` reject unknown arguments; the shared argument, schema and vocabulary-tool helpers live in
    `common/api/` (ADR 0034).
- Tools reuse the REST request DTOs and their `toNew<Kind>()` mappers and turn domain exceptions into
  `CallToolResult(isError = true)`.
