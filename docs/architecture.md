# Architecture

Media Tracker is a single JAR: a Ktor server that hosts a JSON API, a hand-written login page, and the
compiled React single-page app. It runs on a Raspberry Pi and talks to the central MariaDB on that same Pi
(decision record 0018). The documentation index with every feature page and ADR is [index.md](index.md).

## Request flow

```
Browser ──GET /games/watchlist?…▶ Ktor ── no valid session ──▶ 302 /login?returnTo=%2Fgames%2Fwatchlist%3F…
        ◀─ login.html ─────  (public tier: /login, /login/static/*, /health)
        ──POST /login?returnTo=…▶ AuthService.login ─▶ Argon2id verify ─▶ sessions row ─▶ Set-Cookie MT_SESSION=<signed id>
                                 ─▶ 302 to safeReturnPath(returnTo), else /
        ──GET /games/watchlist?… (+cookie)▶ DbSessionStorage.read ─▶ UserSession principal ─▶ app/index.html
        ──GET /api/me──────▶ authenticate("session") ─▶ {"username": "..."}
        ──GET /api/games───▶ authenticate("session") ─▶ GameRoutes ─▶ GameService ─▶ ExposedGameRepository ─▶ MariaDB
        ──GET /api/games/cover-options, /title-suggestions▶ CoverOptionRoutes ─▶ CoverOptionsService ─▶ SteamGridDbCoverSource ─▶ steamgriddb.com
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
to `/login?returnTo=<the requested path and query>`. After the login it lands there, if `safeReturnPath` accepts
the target (record 0031). Both providers live in `auth/api/Security.kt`; `authenticate(name)` only consults the provider named
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
- A logged-in user changes their own password in the settings dialog (`PUT /api/me/password`). The current
  session row is kept, every other session of that user is deleted. Decision record 0032.

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
  (`description`, `coverImageUrl`; a game matches when any listed property is `null`, decision record 0022),
  `rated` and `sort` as on `GET /api/games` (decision record 0030);
  returns the best matches of `GET /api/games` without paging - `pageSize` many, 10 by default and 100 at most,
  with `totalMatches` and `truncated` alongside them in the structured result; at least one of query or filter is
  required) and `update_game` (the fields of `PATCH /api/games/{id}` plus
  the required `id`, which an agent looks up with `search_games`; only the fields passed are changed;
  `description`, `rating`, `coverImageUrl` and `releaseDate` accept `null` to clear, every other field rejects an explicit `null`
  rather than silently ignoring it), plus `list_expansions` and `add_expansion` for a game's DLC (both take the `gameId` an agent got from
  `search_games`; `add_expansion` appends) and `find_game_cover` (`title`, optional `releaseYear`: the first static
  SteamGridDB cover of the best match, only registered when `STEAMGRIDDB_API_KEY` is set), plus
  `search_game_developers` and `create_game_developer` (idempotent) for the `developerIds` of `add_game`/`update_game`
  (decision record 0029), all in `games/api/GameMcpTools.kt`. Books contributes the equivalents in
  `books/api/BookMcpTools.kt` (decision record 0034): `list_book_types`, `add_book`, `search_books` (query and the
  filters `typeIds`, `ownership`, `progress`, `releaseYears`, `hasMissing`, `pageSize`; no `sort`/`rated`),
  `update_book` (`description`, `coverImageUrl` and `releaseDate` clearable), `search_book_authors`,
  `create_book_author`, `search_book_narrators`, `create_book_narrator`, `search_book_series` and
  `create_book_series` (decision record 0035); neither kind has a delete tool. The `ownership` and `progress` arguments
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
├── Schema.kt           allTables: every Exposed table object, for the schema drift check; backupSources:
│                       every domain's BackupSource (decision record 0027)
├── config/             AppConfig, DatabaseConfig, SessionConfig, CoverSourceConfig/SteamGridDbConfig,
│                       DropboxConfig, BackupConfig (typed application.yaml; the SteamGridDB key and the Dropbox
│                       key/secret pair are optional, absent = no cover source / no Dropbox)
├── common/             shared code in the same three layers as a feature; knows no feature:
│   ├── api/            shared DTOs (ErrorResponse, HealthResponse, PageResponse<T>; mirrored in
│   │                   frontend/src/types/api.ts), PatchField (+ serializer), Paging (?page/?pageSize parsing),
│   │                   Search (?search parsing), QueryParams (repeatable filter values, MAX_FILTER_VALUES,
│   │                   booleans), McpToolArguments (argument readers and checks), McpSchemas (JSON-schema
│   │                   fragments of the shared value classes and WireEnums), VocabularyMcpTools (search/create
│   │                   tools of a name vocabulary)
│   ├── domain/         InvalidValueException/NotFoundException/requireValid,
│   │                   ExternalSourceUnavailableException/ExternalSourceException (an outbound source's
│   │                   503/502, coded by source name), PageNumber/PageSize/PageRequest/Page<T>, Patch<T>, SearchTerm,
│   │                   BackupSource (port: a domain's tables as plain rows, export + insert-if-absent import),
│   │                   CloudStorage + StoredFile (port: upload a file, find its metadata),
│   │                   MediaValues (Title, ReleaseYear, ReleaseDate, Description, CoverImageUrl, HexColor),
│   │                   ReleaseDating (the date-beats-year rules), WireEnum (+ fromWire), Vocabulary
│   │                   (VocabularyName, VocabularySearchLimit, VocabularyCreation; decision record 0034)
│   └── persistence/    DatabaseFactory (HikariCP, Flyway migrate, Exposed, drift statements), dbQuery(),
│                       ExposedBackupSource (generic BackupSource over a list of Exposed tables),
│                       LocalDateColumnType (DATE bound as java.time.LocalDate via JDBC 4.2, zone-free),
│                       FulltextQuery (boolean-mode text), FulltextExpressions (MATCH ... AGAINST predicate,
│                       clamped MatchScore), TitleSearch (fulltext or LIKE prefix match + relevance order),
│                       FilterOps (inListIfAny), ExposedNameVocabulary (search, findByIds, race-safe idempotent
│                       create of a unique-name vocabulary)
├── plugins/            Serialization, Monitoring, StatusPages
├── auth/               CreateUser (bootstrap CLI) plus the same three layers as a media kind:
│   ├── api/            LoginRoutes (/login, /logout), MeRoutes (/api/me), ApiKeyRoutes (/api/me/api-keys),
│   │                   PasswordRoutes (/api/me/password) +
│   │                   AuthDtos, Security (SESSION_AUTH + API_KEY_AUTH providers and their challenges,
│   │                   ApiKeyPrincipal), Sessions (cookie + storage plugin), UserSession (principal), DbSessionStorage
│   ├── domain/         AuthService (login, changePassword), ApiKeyService, ApiKeys (ApiKey, ApiKeySlot),
│   │                   NewPassword (minimum length for CLI and API), PasswordHasher (Argon2id),
│   │                   User + UserRepository, StoredSession + SessionRepository
│   └── persistence/    UsersTable, SessionsTable, ExposedUserRepository (+ *Blocking helpers),
│                       ExposedSessionRepository
├── backup/             technical domain, knows only the BackupSource port (decision record 0027):
│   ├── api/            BackupRoutes (/api/backup/export, /api/backup/import, /api/backup/dropbox) + BackupDtos,
│   │                   JsonBackupCodec (rows <-> JSON; implements BackupEncoder), BackupScheduler (daily
│   │                   coroutine launched in module(), nextRun, one retry; decision record 0028)
│   └── domain/         BackupService (merges the sources, rejects unknown tables, dispatches import slices),
│                       BackupEncoder (port), CloudBackupService (export -> encode -> CloudStorage upload of
│                       /backup/full-export.json, lastBackup)
├── dropbox/            technical domain, knows no feature and not backup (decision record 0028):
│   ├── api/            DropboxRoutes (/api/dropbox, /authorize-url, /connection) + DropboxDtos
│   ├── domain/         DropboxService (implements CloudStorage; access-token cache, refresh, connect/disconnect),
│   │                   DropboxApi and DropboxConnectionRepository (ports), AuthorizationCode, RefreshToken
│   ├── integration/    DropboxHttpApi (Ktor client: oauth2/token, token/revoke, files/upload, files/get_metadata)
│   └── persistence/    OAuthConnectionsTable (system table), ExposedDropboxConnectionRepository
├── mcp/                technical domain, api layer only, knows no feature:
│   └── api/            McpEndpoint (stateless Streamable HTTP route + McpJson encoding), McpServer (server factory)
├── books/              second media kind (decision record 0034), same layers as games, no integration:
│   ├── api/            BookDtos (+ mappers), BookRoutes (/api/books, /api/books.meta, /api/book-types,
│   │                   /api/book-authors, /api/book-narrators, /api/book-series, /api/book-series.summaries,
│   │                   /api/book-series/{id}/books), BookFilterParams,
│   │                   BookMcpTools (list_book_types, add_book, search_books, update_book, search/create for
│   │                   book authors, narrators and series)
│   ├── domain/         BookValues (BookId, BookTypeId, BookTypeLabel, BookAuthorId, BookNarratorId,
│   │                   BookSeriesId, BookSeriesPosition), BookStatus (BookOwnership, BookProgress),
│   │                   Book/NewBook/BookPatch, BookType, BookAuthor, BookNarrator, BookSeries/BookSeriesEntry/
│   │                   BookSeriesSummary,
│   │                   BookFilters (incl. BookMissingField)/BookMeta, BookRepository, BookTypeRepository,
│   │                   BookAuthorRepository, BookNarratorRepository, BookSeriesRepository (interfaces),
│   │                   BookService, BookAuthorService, BookNarratorService, BookSeriesService
│   └── persistence/    BooksTable, BookTypesTable, BookToTypeTable, BookAuthorsTable, BookToAuthorTable,
│                       BookNarratorsTable, BookToNarratorTable, BookSeriesTable, BookToSeriesTable,
│                       ExposedBookRepository, ExposedBookTypeRepository, ExposedBook{Author,Narrator,Series}Repository
│                       (delegate to ExposedNameVocabulary), BooksBackupSource (the nine books tables)
└── games/              first media kind (MT-001, decision record 0007):
    ├── api/            GameDtos (+ DTO <-> domain mappers), GameRoutes (/api/games, /api/games.meta,
    │                   /api/game-platforms, /api/game-developers), GameFilterParams (the repeatable filter query parameters),
    │                   ExpansionDtos and ExpansionRoutes (/api/games/{id}/expansions, mounted inside the
    │                   game's /{id} block), CoverOptionDtos and CoverOptionRoutes (/api/games/cover-options
    │                   and /api/games/title-suggestions, game-independent), GameMcpTools (MCP tools
    │                   list_game_platforms, add_game,
    │                   search_games incl. hasMissing and pageSize, update_game, list_expansions, add_expansion,
    │                   find_game_cover, search_game_developers, create_game_developer)
    ├── domain/         GameValues (GameId, Rating, GamePlatformId, PlatformLabel, GameDeveloperId), GameStatus (Ownership, Progress,
    │                   DEFAULT_HIDDEN), Game/NewGame/GamePatch, GamePlatform, GameFilters (incl. MissingField)/GameMeta,
    │                   GameRepository, GamePlatformRepository and GameDeveloperRepository (interfaces), GameService,
    │                   GameDeveloperService,
    │                   Expansion/NewExpansion/ExpansionPatch (ExpansionId, SequenceNumber),
    │                   ExpansionRepository (interface), ExpansionService (owns the dense sequence),
    │                   CoverSource (port: searchGames, findCovers) with CoverSourceGameId/CoverCandidate/
    │                   CoverOption/CoverOptions/CoverLookup (findCovers takes the page size), CoverMatchRanking
    │                   (selectBestMatch), CoverOptionsService (find for the picker, findFirstCover for MCP,
    │                   suggestTitles for the form, empty on failure)
    ├── persistence/    GamesTable, GamePlatformsTable, GameToPlatformTable, GameExpansionsTable,
    │                   GameDevelopersTable, GameToDeveloperTable (Exposed),
    │                   ExposedExpansionRepository, ExposedGameRepository
    │                   (findPage by title, search by title prefix/fulltext and filters, findUsedFilterValues),
    │                   ExposedGamePlatformRepository, ExposedGameDeveloperRepository (delegates to
    │                   ExposedNameVocabulary), GamesBackupSource (the six games tables, parents first)
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
| `PUT /api/me/password` | 204 | body `ChangePasswordRequest {currentPassword, newPassword}`; 400 `validation_error` if the new one is shorter than 8, 403 `wrong_password` if the current one is wrong; keeps the calling session, deletes the user's other sessions |
| `GET /api/games?page=1&pageSize=50[&search=zelda][&filters]` | 200 `PageResponse<GameResponse>` | 1-based `page`, `pageSize` 1..200 (default 50); ordered by title; with `search` (trimmed, 1..200 chars, blank = absent) matches on the title only: a fulltext hit (every word a prefix term, any word matches) or a title starting with the whole term (`LIKE 'term%'`); prefix hits first, then `MATCH(title)` relevance, then title, id (decision records 0015, 0033); `totalPages` 0 when empty. Four repeatable filter parameters narrow the result: `platformIds`, `ownership`, `progress`, `releaseYear`; repetitions of one parameter mean "any of", different parameters all have to match, and an unknown value is a 400. Any filter takes the same branch as a search, without a term the title order stays (decision record 0021). `rated=true` keeps only rated games; `sort` is `title` (default, the order above), `release_asc`/`release_desc` (year, dated before year-only, date, then title, id) or `rating_desc` (then title, id); a non-default `sort` replaces the relevance order of a search; unknown values are a 400 (decision record 0030) |
| `POST /api/games` | 201 `GameResponse` + `Location` | body `CreateGameRequest`: `releaseYear` required unless `releaseDate` (`YYYY-MM-DD`, optional) is given, whose year then overrides it (decision record 0029); `platformIds` (at least one seeded platform id), `developerIds` optional, `description` (max 10000 chars), `rating` (0.25..5 in quarter steps) and `coverImageUrl` optional; `ownership` (`watchlist`/`subscription`/`owned`, default `watchlist`), `progress` (`abandoned`/`not_started`/`paused`/`playing`/`finished`/`completed`, default `not_started`) and `hidden` (default `false`) optional, an unknown value is a 400 (decision record 0017) |
| `PATCH /api/games/{id}` | 200 `GameResponse` | body `UpdateGameRequest`: omit a field to keep it, `null` clears `description`, `rating`, `coverImageUrl` or `releaseDate` (clearing the date keeps the year; a set date overrides the year), `platformIds` and `developerIds` replace the whole set; `ownership`, `progress` and `hidden` cannot be cleared, so an explicit `null` on them means unchanged (as for `title`, `releaseYear` and `platformIds`); 404 for unknown ids |
| `DELETE /api/games/{id}` | 204 | also for unknown ids (idempotent); junction rows go with the game (`ON DELETE CASCADE`) |
| `GET /api/games/{id}/expansions` | 200 `ExpansionResponse[]` | a game's expansions (DLC), ordered by `sequence`, which is dense and zero-based per game; 404 if the game is unknown (decision record 0023) |
| `POST /api/games/{id}/expansions` | 201 `ExpansionResponse` + `Location` | body `CreateExpansionRequest`: `title` required, `ownership` and `progress` optional with the game's own defaults; appended at the end of the order; 404 if the game is unknown |
| `PATCH /api/games/{id}/expansions/{expansionId}` | 200 `ExpansionResponse` | body `UpdateExpansionRequest`: every field optional, `null` never clears (nothing on an expansion is clearable), so no `PatchField`. A `sequence` is a move: the expansion is reinserted at that index and the whole order is renumbered; outside `0..n-1` it is a 400. 404 for an unknown expansion or one belonging to another game |
| `DELETE /api/games/{id}/expansions/{expansionId}` | 204 | idempotent, also for unknown ids; the remaining sequences are re-packed. Deleting the game takes its expansions with it (`ON DELETE CASCADE`) |
| `GET /api/games/cover-options?query=hades[&releaseYear=2020][&match=5245][&type=animated][&page=2]` | 200 `CoverOptionsResponse {query, matches, selectedMatchId, type, covers}` | cover suggestions from SteamGridDB for the cover picker (decision record 0024), independent of any stored game so the add dialog can use it: `matches` are the provider's games for the required search term (`query`, same 1..200 limits as `?search`; missing or blank is a 400), `selectedMatchId` the one the ranking picked (exact title, then the same `releaseYear` when one is given, then first; `null` when nothing matched) and `covers` (`thumbnailUrl`, `imageUrl`, `width`, `height`) only for that one; `match` picks another candidate instead (empty = absent, anything but a positive integer is a 400); `releaseYear` is optional (blank = absent, a non-integer or a year outside 1000..9999 is a 400); `type` is `static` (default) or `animated`, `page` is 1-based (default 1) and `covers` is a `PageResponse` of at most 50 per page in SteamGridDB's score order (`totalItems`/`totalPages` from the provider; `pageSize` is not accepted); an unknown `type`, `page=0` or a non-integer `page` is a 400 naming the field; a page after the first with `match` given skips the upstream search and returns `matches` empty; `503 cover_source_unavailable` when no `STEAMGRIDDB_API_KEY` is configured, `502 cover_source_error` when the provider fails |
| `GET /api/games/title-suggestions?query=hollow%20kn` | 200 `TitleSuggestionsResponse {suggestions}` | title suggestions for the add/edit form (decision record 0026): up to 8 `CoverMatchResponse` (`id`, `name`, `releaseYear` or `null`, `verified`) from the SteamGridDB search, in its order; `query` has the same 1..200 limits as `?search`, missing or blank is a 400; an unconfigured or failing SteamGridDB yields an empty list, never 502/503 |
| `GET /api/games.meta` | 200 `GameMetaResponse` | the values the four filters can take, and only those that occur in a stored game: `platforms` (`GamePlatformResponse[]`, by label), `ownership` and `progress` (wire strings in the order `GameStatus.kt` declares them), `releaseYears` (descending, newest first). `.meta` is the convention for a resource's lookup data (decision record 0021) |
| `GET /api/game-platforms` | 200 `GamePlatformResponse[]` | seeded reference data (`id`, `label`, `associatedColor` as `RRGGBB`), ordered by label; read-only for now (decision record 0009) |
| `GET /api/game-developers?search=nin&limit=10` | 200 `GameDeveloperResponse[]` | `id`, `name`; prefix fulltext match on the name plus `name LIKE 'term%'` for names InnoDB does not index (under three characters, stopwords), with LIKE hits first, `limit` 1..50 (default 10), blank `search` lists by name (decision record 0029) |
| `POST /api/game-developers` | 201 / 200 `GameDeveloperResponse` | body `{name}` (trimmed, 1..128 chars); 201 when created, 200 with the existing row when the name exists (case-insensitive) |
| `GET /api/books?page=1&pageSize=50[&search=dune][&filters]` | 200 `PageResponse<BookResponse>` | as `GET /api/games` (paging, title-only search and its order), with the repeatable filters `typeIds`, `ownership` (`watchlist`/`owned`), `progress` (`abandoned`/`not_started`/`paused`/`reading`/`finished`), `releaseYear`; the type filter is a semi-join; no `sort`, no `rated` (decision record 0034) |
| `POST /api/books` | 201 `BookResponse` + `Location` | body `CreateBookRequest`: `title`, `releaseYear` required unless `releaseDate` is given, `typeIds`, `authorIds`, `narratorIds` and `series` (`[{seriesId, position?}]`, position 0..9999.99 with at most two decimals, a repeated `seriesId` is a 400) optional (default `[]`, a book may have no type), `description`, `coverImageUrl`, `ownership` (default `watchlist`), `progress` (default `not_started`) optional |
| `PATCH /api/books/{id}` | 200 `BookResponse` | body `UpdateBookRequest`: as for games; `null` clears `description`, `coverImageUrl` or `releaseDate`; `typeIds`/`authorIds`/`narratorIds`/`series` replace the set (may be empty); 404 for unknown ids |
| `DELETE /api/books/{id}` | 204 | idempotent; junction rows cascade |
| `GET /api/books.meta` | 200 `BookMetaResponse` | `types`, `ownership`, `progress`, `releaseYears` in use, ordered as for games |
| `GET /api/book-types` | 200 `BookTypeResponse[]` | seeded (Hardcover, Paperback, Kindle, Audible; `id`, `label`, `associatedColor`), ordered by label |
| `GET /api/book-authors?search=le&limit=10` / `POST /api/book-authors` | 200 `BookAuthorResponse[]` / 201 or 200 `BookAuthorResponse` | as `/api/game-developers` |
| `GET /api/book-narrators` / `POST /api/book-narrators` | 200 `BookNarratorResponse[]` / 201 or 200 `BookNarratorResponse` | as `/api/game-developers` |
| `GET /api/book-series` / `POST /api/book-series` | 200 `BookSeriesResponse[]` / 201 or 200 `BookSeriesResponse` | as `/api/game-developers`; a book's links come back as `BookResponse.series` `[{id, name, position}]` (decision record 0035) |
| `GET /api/book-series.summaries` | 200 `BookSeriesSummaryResponse[]` | every series (also those without books) with `id`, `name`, `bookCount`, ordered by name; unpaged; feeds the series view (MT-043) |
| `GET /api/book-series/{id}/books` | 200 `BookResponse[]` | the books of one series, unpaged, ordered by their position in it (books without one last), then title; 404 for an unknown series |
| `GET /api/backup/export` | 200 JSON object | one property per domain table (DB name), each an array of rows keyed by DB column name; the system tables `users`, `sessions` and `oauth_connections` are excluded (decision records 0027, 0028) |
| `POST /api/backup/import` | 200 `ImportResultResponse {tables}` | body: an export as raw JSON; per table `{inserted, skipped}`; rows whose primary key exists are skipped, nothing is updated; unknown table or column, a missing non-nullable column (a missing nullable one is `null`), wrong value type or a constraint violation is a 400 `validation_error` and rolls back that source |
| `GET /api/backup/dropbox` | 200 `CloudBackupResponse {lastBackup}` | `lastBackup` is `{modifiedAt, sizeBytes}` of `/backup/full-export.json` in the Dropbox App folder, read live from Dropbox, or `null`; 503 `dropbox_unavailable` when not configured or not connected, 502 `dropbox_error` when Dropbox fails (decision record 0028) |
| `POST /api/backup/dropbox` | 200 `CloudBackupResponse` | uploads the export (the same bytes as `GET /api/backup/export`) now, overwriting the file; same 503/502 |
| `GET /api/dropbox` | 200 `DropboxStatusResponse {available, connected, connectedAt}` | `available` = app key and secret configured; `connectedAt` ISO-8601 or `null` |
| `GET /api/dropbox/authorize-url` | 200 `AuthorizeUrlResponse {url}` | the no-redirect OAuth code-flow URL (`token_access_type=offline`); 503 `dropbox_unavailable` when not configured |
| `POST /api/dropbox/connection` | 200 `DropboxStatusResponse` | body `ConnectDropboxRequest {code}`: exchanges the pasted code for a refresh token stored in `oauth_connections`; a blank, overlong or rejected code is a 400 `validation_error` |
| `DELETE /api/dropbox/connection` | 204 | revokes the token at Dropbox (best effort) and deletes it; idempotent |

Errors are `ErrorResponse {error, message?}` with codes `validation_error` (400, a value class rejected a field:
`"title: must not be blank"`), `invalid_body` (400, malformed or ill-typed JSON, missing body), `not_found` (404),
`unauthorized` (401), `method_not_allowed` (405, GET/DELETE on `/mcp`, answered by `mcp/api/McpEndpoint.kt` itself),
`<source>_unavailable` (503, an outbound source such as `cover_source` is not configured, or `dropbox` is not connected) and `<source>_error` (502,
it failed; the upstream status and error list are logged, never returned), `internal_error` (500). The exception mapping lives in `plugins/StatusPages.kt` and also applies to `/mcp`.

`POST /mcp` speaks JSON-RPC 2.0 per the MCP specification (`initialize`, `tools/list`, `tools/call`); authentication
failures are the same JSON `401` plus `WWW-Authenticate: Bearer`. Tool validation failures are returned as tool
results with `isError: true` and the domain message, not as HTTP errors.

## Module map (frontend)

```
frontend/src
├── main.tsx / App.tsx / AppProviders.tsx   BrowserRouter (main.tsx), i18n init, theme + CssBaseline, MUI X
│                                           LocalizationProvider (dayjs, de/en), shell (AppHeader, MediaTabs,
│                                           SubPageTabs, <Routes> with the redirects)
├── routes.ts             paths derived from MEDIA_KINDS / MEDIA_SUB_PAGES, last-used route in localStorage
│                         (mt.mediaTab, mt.booksPage, mt.gamesPage) for the / and /{kind} redirects (record 0031)
├── theme/                MUI theme: login-page palette, system font stack; light/dark from the header
│                         toggle (mode.ts: localStorage key mt.mode, default "system" = OS preference)
├── i18n/                 i18next setup, en.json / de.json bundles (typed keys via i18next.d.ts), language storage
├── api/client.ts         apiFetch (401 -> /login?returnTo=<current location>, 204 -> undefined, ApiError with the
│                         parsed ErrorResponse)
├── types/api.ts          hand-written mirrors of the backend DTOs
├── hooks/                useActiveRoute (kind + sub-page of the location), useDebouncedValue (search fields),
│                         useSearchDebounceMs (SEARCH_DEBOUNCE_MS + context, tests shorten it), useViewParams,
│                         useUrlSearchInput, usePagedActions (pagination bars + page corrections), useLoadOnce
│                         (meta and reference lists), useVocabularySuggestions (debounced vocabulary lookup)
├── domain/media/         kind-neutral pure TS (record 0034): values (validators returning i18n codes),
│                         releaseDate (fixed YYYY-MM-DD format), draft (normalisers, withReleaseDate),
│                         vocabularyDraft (pending names, resolveVocabularyIds), viewParams (URL field codecs)
├── components/           shared UI: layout/ (AppHeader, LanguageMenu, ThemeModeToggle, SettingsButton,
│                         LogoutButton, MediaTabs, SubPageTabs, mediaKinds + MEDIA_SUB_PAGES), dialog/ (BaseDialog, ConfirmDialog,
│                         DialogActionButton), CoverImage (optionally a button, for the cover picker; aspect
│                         ratio per kind, coverFrame), ComingSoon, media/ (kind-neutral media UI, record 0034:
│                         MediaViewHeader, SearchField, ResultsBar, PaginationBar, MediaGrid, MediaCardShell,
│                         CoverAndInfoLayout, ColorChip(s), DetailField, ReleaseDetail, NameChips, status/
│                         (StatusToggleBar: exclusive or multiple icon toggles, StatusFilterBar, StatusIcon),
│                         filters/ (FilterSelect, FilterRow), fields/ (TitleField, DescriptionField,
│                         ReleaseYearField, ReleaseDateField, CoverImageUrlField, VocabularyField,
│                         ColoredOptionsField, FieldLegend))
├── features/settings/    UserSettingsDialog (tab bar; "Password" (default), "API Keys" and "Export / Import" tabs) +
│                         api/ (settingsApi, backupApi, dropboxApi), hooks/ (useApiKeys, useExportImport, useDropbox,
│                         useCloudBackup), domain/ (downloadJson: Blob download, dropboxValues: code validator,
│                         passwordValues: password validators, cloudBackupFormat: Intl date/size), components/
│                         (PasswordTab + fields/PasswordField; ApiKeysTab, ApiKeyField: masked read-only key, reveal,
│                         copy, regenerate; ExportImportTab: export download, file-picker import with per-table
│                         counts, DropboxBackupSection: connect by pasted code, last backup, back up now,
│                         disconnect; fields/AuthorizationCodeField)
├── features/<kind>/      one standalone view per media kind; movies and series are "coming soon"
├── features/books/       BooksView (overview at /books/overview), BookSeriesView (series accordion at
│                         /books/series, MT-043) + api/booksApi, hooks/ (useBooksPage, useBooksMeta, useBookTypes,
│                         useBookSeriesSummaries, useSeriesBooks), domain/ (bookStatus, bookValues incl. the 2:3
│                         cover ratio, bookFilters, bookDraft, bookViewParams, bookSeriesViewParams, seriesLabel,
│                         seriesSearch), components/ (BookCard, BookSeriesAccordion, BookStatusIcons,
│                         Book{Ownership,Progress}ToggleBar, BookStatusFilterToggles, BookFilterBar,
│                         BookOverviewFilters, BookForm, BookDetails, BookDetailDialog, AddBookDialog,
│                         BookDialogsHost, fields/AuthorsField, fields/NarratorsField, fields/SeriesField,
│                         fields/SeriesPositionField, fields/BookTypesField)
└── features/games/       GamesView (overview: MediaViewHeader = search field / filter bar /
                          ResultsBar: count + top pagination),
                          GamesWatchlistView, GamesRankingView (sub-pages, ADR 0030) + api/ (gamesApi,
                          ?search, the filter parameters, sort and rated, listAllGames (every page of 200),
                          games.meta, cover-options, title-suggestions;
                          expansionsApi), hooks/ (useGamesPage, useAllGames, useGamesMeta, useGamePlatforms, useExpansions, useCoverOptions,
                          useTitleSuggestions), domain/ (gameValues validators,
                          gameDraft, expansionDraft, gameFilters: the selection and its stable key, gameViewParams: the
                          URL query codecs of the three views, gameStatus:
                          ownership/progress values and defaults, rankingYears: the ranking's year list),
                          components/ (GamesGrid over MediaGrid, GameCard/WatchlistGameCard/
                          RankingGameCard, GameDialogsHost: FAB + add/detail dialogs, ReleaseSortToggle,
                          YearNavigator,
                          GameFilterBar (platform + release year),
                          ProgressToggleBar + OwnershipToggleBar + StatusFilterToggles (overview progress/ownership filter) +
                          OverviewFilters (toggles + standard selects in the results row), detail/add dialogs,
                          fields/, ExpansionList/ExpansionCard:
                          the sortable DLC stack inside the detail dialog, ExpansionDialog, CoverPickerDialog:
                          SteamGridDB thumbnails behind the clickable cover of the detail dialog and of the
                          add/edit form (persistence-agnostic: the detail dialog PATCHes the pick, the form
                          fills its URL field), with a static/animated toggle and a load-more button over the
                          paged result;
                          CoverThumbnail: <video> for the WebM clips SteamGridDB uses as animated thumbnails)
```

Beyond React, MUI and i18next, the frontend has two runtime dependencies:
- @dnd-kit (`core`, `sortable`, `utilities`) drags the expansion cards, and the reorder test drives its keyboard
  sensor (decision record 0023).
- `@mui/x-date-pickers` with `dayjs` renders the release date picker (decision record 0029).
- `react-router` (declarative mode) maps the paths to views and keeps the view state in the query (decision
  record 0031).

Browser state: the URL (route and view query, record 0031), `localStorage["mt.language"]` (`en`/`de`), and
`localStorage["mt.mediaTab"]` (`books`/`games`/`movies`/`series`) plus `["mt.booksPage"]` and `["mt.gamesPage"]`,
the last-used route read only by the `/`, `/books` and `/games` redirects. The SPA does not call `/api/me` at startup; being served `index.html` already implies a valid session,
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
- `STEAMGRIDDB_API_KEY` is optional: with it the cover picker queries SteamGridDB through
  `games/integration/SteamGridDbCoverSource` (Ktor client, JDK `HttpClient` engine, 10 s timeout); without it
  the endpoint answers `503 cover_source_unavailable` and the picker says so. Decision record 0024.
- `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET` (a pair) enable the Dropbox backup. The refresh token comes from
  the in-app connect flow and lives in `oauth_connections`. `BackupScheduler` is a coroutine in the application
  scope, cancelled with it. It uploads the export daily at `BACKUP_DAILY_AT` (default `03:00`) in `BACKUP_ZONE`
  (default `Europe/Berlin`, since the image runs in UTC), with one retry after an hour. Decision record 0028.
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
