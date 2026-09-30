# Game sub-pages: overview, watchlist, yearly ranking (MT-026)

ADR: [0030](../decisions/0030-game-sub-pages-sort-and-rated-filter.md).

Code:
- Backend: `games/domain/GameSort.kt`, `GameFilters.ratedOnly`, `ExposedGameRepository.orderingFor`,
  `games/api/GameFilterParams.kt`.
- Frontend: `components/layout/SubPageTabs.tsx`, `MEDIA_SUB_PAGES` in `components/layout/mediaKinds.ts`,
  `hooks/useStoredChoice.ts`, `hooks/useGamesSubPage.ts`, `features/games/GamesWatchlistView.tsx`,
  `features/games/GamesRankingView.tsx`, and the shared `features/games/components/GameDialogsHost.tsx`,
  `features/games/components/GameCardShell.tsx` and `features/games/hooks/usePagedGameActions.tsx`.

## Navigation

- A second, smaller tab row sits under the media tabs. It is shown only for kinds listed in `MEDIA_SUB_PAGES`,
  which today is games only (`overview`, `watchlist`, `ranking`). Each tab has a decorative start icon
  (`GridViewOutlined`, `LibraryAddOutlined` like the watchlist status icon, `LeaderboardOutlined`), mapped in
  `App.tsx` and passed to `SubPageTabs` as `getIcon`.
- The chosen sub-page is stored in localStorage under `mt.gamesPage` through the generic `useStoredChoice`,
  which also backs `useStoredTab`. An unknown stored value falls back to `overview`. There is no router, so a
  sub-page has no URL of its own.
- Every sub-page renders `GameDialogsHost`: the FAB, the add dialog and the detail dialog, including editing,
  deleting and expansions. The page owns the selected game and reloads its list and `/api/games.meta` after a
  create, an update or a delete.
- Cards are `GameCardShell` (cover, title, click) with a page-specific body. `GamesGrid` takes a `renderCard`
  prop.

## Watchlist

- Shows games with ownership `watchlist`; the tab carries the ownership label ("Watchlist", German
  "Merkliste").
- Header (`GamesViewHeader` as on the overview): the search field first, then the platform `FilterSelect`
  (exported from `GameFilterBar.tsx`) and a `fullWidth` `ReleaseSortToggle` in `controlsLayout="half"`. That
  row is centered at the search field's width and split into two equal columns (stacked at `xs`). The
  results bar comes last.
  The toggle is an exclusive `ToggleButtonGroup`, "Oldest first" (`release_asc`, the default) / "Newest
  first" (`release_desc`), and it cannot be deselected.
- Paging and the results bar work as on the overview: `GAMES_PAGE_SIZE`, the count and the
  top `PaginationBar` in the header's results bar, and a second `PaginationBar` below the grid. A change of the
  search, the filter or the sort returns to page 1.
- `usePagedGameActions` (shared with the overview) reloads after a create, an update or a delete. When a reload
  leaves a later page empty, it steps back to the last page. On the watchlist this happens, for example, when
  the only game on the last page is set to owned.
- Cards show cover, title and the formatted release date, or the year when no date is set.
- Within one year, dated games come before games with only a year, in both directions (ADR 0030).

## Yearly ranking

- Shows the rated games of one release year, `rating_desc` with title and id as tiebreak. Unrated games are
  never shown (`rated=true`).
- The year is loaded as a whole: `listAllGames` walks pages of `ALL_GAMES_PAGE_SIZE` (200).
- `YearNavigator` sits centered above and below the grid. It has an older/newer IconButton on each side of a
  single-select year Select, and both copies share one state. The top copy is the first row of
  `GamesViewHeader` (`controlsLayout="center"`, no search row). Its results bar shows the number of ranked
  games in that year, centered because there is no pagination. It shows no count while the year loads.
- The years are `releaseYears` from `/api/games.meta` up to the current year, plus the current year
  (`domain/rankingYears.ts`). Future years are not offered. The page starts on the current year, and a year
  without rated games shows an empty state.
- Cards show cover, title and a read-only quarter-step `Rating`. Its value is also the card button's
  accessible description.
- While a year loads, the grid shows skeletons, so the previous year's cards never appear under the new label.
- Each of the two navigators is a labelled group (top/bottom), which keeps their controls apart for screen
  readers.

## REST and MCP

- `GET /api/games` takes `sort=title|release_asc|release_desc|rating_desc` and `rated=true|false`. See the API
  table in [architecture.md](../architecture.md).
- `search_games` takes the same two arguments. The MCP rule that a query or a filter is required still holds,
  so `sort` alone is not enough.
