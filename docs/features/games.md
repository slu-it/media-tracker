# Games (MT-001)

ADRs: [0007](../decisions/0007-layered-domain-modules.md), [0009](../decisions/0009-game-platforms-as-reference-data.md).
Code: `backend/src/main/kotlin/de/sluit/mediatracker/games/`, `frontend/src/features/games/`.

Games is the first media kind of phase 2 and the template for Books, Movies and Series, which are "coming soon"
tabs in `frontend/src/features/{books,movies,series}/`. A new media kind copies the `games` package on both
sides, adds its service to `Services` in `Application.kt` (and to `handlerApp` in the tests), mounts its routes
in `apiRoutes`, and copies the games dialogs including both scroll flags described below.

## Domain

- A game has a title, a release year, an optional description, an optional external cover URL and an optional
  quarter-step rating. Value classes validate in `init`; the frontend mirrors each rule as a validator.
- Platforms are many-to-many from the seeded `game_platforms` table (fixed UUIDs, hex colours, ADR 0009)
  through `game_to_platform`. Labels come from `GET /api/game-platforms`, not from the i18n bundles.
- Later tickets added [status fields](game-status-fields.md), [search and filters](game-search-and-filters.md),
  [expansions](game-expansions.md) and the [cover picker](cover-picker.md).

## REST

`GET /api/games?page=&pageSize=&search=&<filters>` (`pageSize` 1..200, backend default 50), `POST /api/games`,
`GET`/`PATCH`/`DELETE /api/games/{id}`, `GET /api/games.meta`, `GET /api/game-platforms`. Optional PATCH fields
use `PatchField` (absent / null / value). The full endpoint table is in [architecture.md](../architecture.md).

## Frontend

- `GamesView.tsx` renders the grid cards, a FAB for create, `GameDetailDialog` and the create/edit dialog.
  Domain constraints are validators in `features/games/domain/` that return i18n codes, wrapped in
  self-validating field components under `components/fields/`.
- The list asks for `pageSize=36` explicitly (`GAMES_PAGE_SIZE` in `games/domain/gameValues.ts`, independent of
  the backend default). The games tests derive their expected URLs from that constant instead of pinning it.
- Above the grid sit the search field, the four `-all-` multi-selects of `components/GameFilterBar.tsx` and a
  `PaginationBar` capped to five page buttons via MUI's `boundaryCount`/`siblingCount`.
- Dialogs build on `components/dialog/BaseDialog` (round protruding close button, optional left action column
  with top and bottom slots, optional fixed height, `contentScroll="children"`); `ConfirmDialog` builds on MUI
  `Dialog` directly. `contentScroll="children"` needs a fixed `height` and hands the scrolling to a child: the
  games dialogs pair it with `scrollInfo` on `CoverAndInfoLayout`, so from the `sm` breakpoint up the headline,
  cover and rating stay frozen and only the field column scrolls, while at `xs` the layout stacks and scrolls
  as one. jsdom evaluates no MUI breakpoint and has no layout engine, so this is verified by eye.
- Every cover frame is 22:31 (the 660x930 grid shape) via `COVER_ASPECT_RATIO`/`coverHeight()` in
  `src/components/coverFrame.ts`; call sites pass a width only.
