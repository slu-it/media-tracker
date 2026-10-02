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
  [expansions](game-expansions.md), the [cover picker](cover-picker.md) and the
  [release date and developers](game-release-date-and-developers.md) and the
  [sub-pages](game-sub-pages.md) (watchlist, yearly ranking).

## REST

`GET /api/games?page=&pageSize=&search=&<filters>` (`pageSize` 1..200, backend default 50), `POST /api/games`,
`GET`/`PATCH`/`DELETE /api/games/{id}`, `GET /api/games.meta`, `GET /api/game-platforms`, `GET`/`POST /api/game-developers`. Optional PATCH fields
use `PatchField` (absent / null / value). The full endpoint table is in [architecture.md](../architecture.md).

## Frontend

- `GamesView.tsx` renders the grid cards, a FAB for create, `GameDetailDialog` and the create/edit dialog.
  Domain constraints are validators in `features/games/domain/` that return i18n codes, wrapped in
  self-validating field components under `components/fields/`.
- The list asks for `pageSize=36` explicitly (`GAMES_PAGE_SIZE` in `games/domain/gameValues.ts`, independent of
  the backend default). The games tests derive their expected URLs from that constant instead of pinning it.
- Above the grid sits `GamesViewHeader`, shared by all three games views. Row 1 holds the search field,
  centered at `HALF_ROW_WIDTH` (`components/gamesLayout.ts`: full width below `md`, half the row from `md`).
  Row 2 holds the controls (`controls`, optional), and row 3 is `GameResultsBar`, followed by a divider.
  - The watchlist uses the `controlsLayout="half"` controls row.
  - The overview has no controls row. All four filters sit in the results row
    ([game-search-and-filters.md](game-search-and-filters.md)). The results bar shows
  the match count for the current search and filters (`totalItems`, "142 games", plural keys
  `games.resultCount_*`) as an outlined `Chip` (32px, the height of the page buttons) inside the `role="status"` region on the left. Next to it, outside the live region, is the `facts` slot.
  - On the overview, `facts` holds `OverviewFilters`: the labelled progress and ownership toggle bars, then
    the Platform and Release year selects.
  - With `facts`, the row aligns on the bottom (`alignItems: "flex-end"`). The chip, the bar bottoms, the
    select underlines and the page buttons share one bottom line.
  The top `PaginationBar` is right-aligned. `PaginationBar` is capped to
  five page buttons via MUI's `boundaryCount`/`siblingCount`; a second, right-aligned copy sits below the grid.
  A click on another page in either bar scrolls the window to the top (in `PaginationBar`, so automatic page
  corrections and search/filter resets do not scroll); a click on the current page does nothing (no scroll, no
  history entry).
  The bar shows no count until the first page arrives (keeping its 32px height, the height of the page
  buttons), then keeps the previous count while a new page loads. When nothing matches, it becomes a visually hidden `role="status"`
  region ("0 games" for screen readers) that takes no space, since the visible empty state covers that. On the
  overview it stays visible at 0 while any filter is active ("0 games" plus the toggles, no pagination),
  so the toggles that caused the empty result can be undone. An empty library, or a search with no matches and
  no status filter, hides the row as before. The `role="status"` element keeps the same position in the tree
  either way, so the live region never remounts.
- The vertical gaps between header rows, around both dividers, above the bottom pagination and above an
  error `Alert` are all `SECTION_GAP` (`components/gamesLayout.ts`, 16px). Empty-state messages keep their own
  larger padding.
- Dialogs build on `components/dialog/BaseDialog` (round protruding close button, optional left action column
  with top and bottom slots, optional fixed height, `contentScroll="children"`); `ConfirmDialog` builds on MUI
  `Dialog` directly. `contentScroll="children"` needs a fixed `height` and hands the scrolling to a child: the
  games dialogs pair it with `scrollInfo` on `CoverAndInfoLayout`, so from the `sm` breakpoint up the headline,
  cover and rating stay frozen and only the field column scrolls, while at `xs` the layout stacks and scrolls
  as one. jsdom evaluates no MUI breakpoint and has no layout engine, so this is verified by eye.
- Every cover frame is 22:31 (the 660x930 grid shape) via `COVER_ASPECT_RATIO`/`coverHeight()` in
  `src/components/coverFrame.ts`; call sites pass a width only.
