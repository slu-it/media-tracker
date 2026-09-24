# Cover picker (MT-017)

ADR: [0024](../decisions/0024-cover-picker-steamgriddb.md). Code: `games/domain/CoverSource.kt` (port),
`games/domain/CoverOptionsService.kt` (orchestrator), `games/domain/CoverMatchRanking.kt`,
`games/integration/SteamGridDbCoverSource.kt` (the only class that knows SteamGridDB),
`games/api/CoverOptionRoutes.kt`, `frontend/src/features/games/components/CoverPickerDialog.tsx`.

## Flow

- The cover (image or empty placeholder) is a button that opens `CoverPickerDialog` with SteamGridDB thumbnails
  from the game-independent `GET /api/games/cover-options?query=[&releaseYear=&match=&type=&page=]` (`query`
  required; the route is a sibling of the `/{id}` block, and `CoverOptionsService` needs no repository).
- The dialog is persistence-agnostic (`onPick(imageUrl)`): in the detail dialog's view mode the host PATCHes
  `coverImageUrl` with the full-size URL; in `GameForm` (add dialog and edit mode) the pick only fills the
  "Cover image URL" field and Save persists it. Cover URLs stay external; nothing is downloaded.
- The endpoint returns the provider's `matches` for the term (the SPA sends the game's or the draft's title and
  year), the `selectedMatchId` a pure domain ranking picked (exact title, same year when given, first), and
  `covers` only for that match as a `PageResponse` (50 per page in score order, 1-based `page`; the picker
  appends pages with "load more"). `match` overrides the pick; `type` (`static` default, `animated`) picks the
  grid type via a toggle in the picker. Later pages with a `match` skip the upstream search and return `matches`
  empty; the picker keeps page 1's list.
- Animated grids come with WebM clips as thumbnails, which `CoverThumbnail` renders as a muted looping
  `<video>`; the saved full-size URL is always an image.

## Backend

- `integration` is the fourth onion layer for outbound adapters (`integration -> domain`, plus `config` for its
  own settings). The adapter uses the Ktor client with the `ktor-client-java` engine.
- `STEAMGRIDDB_API_KEY` is optional. Without it `module()` wires no source and the endpoint answers
  `503 cover_source_unavailable` (`ExternalSourceUnavailableException` / `ExternalSourceException` in
  `common/domain`, mapped by StatusPages to `<source>_unavailable` / `<source>_error`).
  `application-test.yaml` pins the key empty so the smoke test always sees that path.
- `CoverSource.findCovers` takes the page size; the picker asks for `COVER_PAGE_SIZE` (50, SteamGridDB's cap).
- The same search also feeds the title suggestions of the game form ([title suggestions](title-suggestions.md)),
  which degrade to an empty list instead of 503/502.
- MCP tool `find_game_cover` (`games/api/GameMcpTools.kt`) uses `CoverOptionsService.findFirstCover`: same search
  and ranking, then one static cover with page size 1. It returns the image URL and the matched game (name, year,
  verified) so an agent can reject a wrong match; no match or no cover is a plain "not found" result. The tool is
  only registered when a cover source is configured (`CoverOptionsService.isAvailable`).
