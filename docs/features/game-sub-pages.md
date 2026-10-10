# Game sub-pages: overview, watchlist, yearly ranking (MT-026)

ADR: [0030](../decisions/0030-game-sub-pages-sort-and-rated-filter.md).

Code:
- Backend: `games/domain/GameSort.kt`, `GameFilters.ratedOnly`, `ExposedGameRepository.orderingFor`,
  `games/api/GameFilterParams.kt`.
- Frontend: `components/layout/SubPageTabs.tsx`, `MEDIA_SUB_PAGES` in `components/layout/mediaKinds.ts`,
  `src/routes.ts`, `features/games/GamesWatchlistView.tsx`,
  `features/games/GamesRankingView.tsx`, and the shared `features/games/components/GameDialogsHost.tsx`,
  `components/media/MediaCardShell.tsx`, `components/media/ReleaseSortToggle.tsx` (shared with the books
  watchlist since MT-055, ADR 0038) and `hooks/usePagedActions.tsx`.

## Navigation

- A second, smaller tab row sits under the media tabs. It is shown only for kinds listed in `MEDIA_SUB_PAGES`,
  which today are games (`overview`, `watchlist`, `ranking`) and books (`overview` only, ADR 0034). Tab labels are
  kind-neutral (`subPages.pages.*`), the tablist label is per kind (`subPages.label.<kind>`). Each tab has a decorative start icon
  (`GridViewOutlined`, `LibraryAddOutlined` like the watchlist status icon, `LeaderboardOutlined`), mapped in
  `App.tsx` and passed to `SubPageTabs` as `getIcon`.
- Each sub-page is a route, `/games/{overview|watchlist|ranking}`, with its search, filters, sort, page or
  year in the query ([url-routes.md](url-routes.md), ADR 0031). The last-used sub-page is still stored under
  `mt.gamesPage`, and `/games` redirects there. An unknown stored value falls back to `overview`.
- Every sub-page renders `GameDialogsHost`: the FAB, the add dialog and the detail dialog, including editing,
  deleting and expansions. The page owns the selected game and reloads its list and `/api/games.meta` after a
  create, an update or a delete.
- Cards are `MediaCardShell` (cover, title, click) with a page-specific body. `GamesGrid` takes a `renderCard`
  prop. Every card shows a watchlist game's cover grayscale at half opacity (`desaturateCover`, see
  [games](games.md)), for visual consistency across the grids; the whole watchlist page is therefore dimmed.

## Watchlist

- Shows games with ownership `watchlist`; the tab carries the ownership label ("Watchlist", German
  "Merkliste").
- Header (`MediaViewHeader` as on the overview): the search field, then the results row. There is no
  controls row.
  - The results row holds the count chip, then the sort toggle, then the platform select, all bottom-aligned
    with the pagination, as on the overview ([game-search-and-filters.md](game-search-and-filters.md)).
  - The sort toggle is `ReleaseSortToggle`, an exclusive `ToggleButtonGroup`: "Oldest first" (`release_asc`,
    the default) / "Newest first" (`release_desc`). It cannot be deselected.
  - The toggle carries a centred "Sort order" legend (German "Sortierung"), has 32px buttons, and shows the
    pressed button in the primary colour.
  - The platform select is the overview's standard `FilterSelect` with a legend label.
  - Filter selects keep at least 160px below `sm` (`filterLayout.ts`). On a phone the platform select wraps
    onto its own full-width line instead of being squeezed next to the toggle.
  - The row stays visible at 0 results while a platform filter is active. An empty watchlist hides it and
    shows its own empty state.
- Paging and the results bar work as on the overview: `GAMES_PAGE_SIZE`, the count and the
  top `PaginationBar` in the header's results bar, and a second `PaginationBar` below the grid. A change of the
  search, the filter or the sort returns to page 1 (it drops `page` from the URL).
- `usePagedActions` (shared with the overview) reloads after a create, an update or a delete. When a reload
  leaves a later page empty, it steps back to the last page. On the watchlist this happens, for example, when
  the only game on the last page is set to owned.
- Cards show cover, title and the formatted release date, or the year when no date is set.
- A dated card also shows a filled `ReleaseDistanceChip` after the date (both in the shared `ReleaseInfo`,
  `components/media/`): the ISO 8601 duration from today to the release (`releaseDistance` in
  `domain/media/releaseDate.ts`), with the semantics of `java.time.Period.between(today, release)`. So today plus
  the duration is the release date, on plain calendar dates without time zones. It counts calendar years, months
  and days and leaves out zero parts, e.g. `P2M16D`. A release today or in the past (`isReleased`, same calendar
  date rule) shows "Available" / "Verfügbar" instead of a zero or negative duration. Year-only cards get no chip,
  as a year is too coarse. Shared with the books watchlist.
- Within one year, dated games come before games with only a year, in both directions (ADR 0030).

## Yearly ranking

- Shows the rated games of one release year, `rating_desc` with title and id as tiebreak. Unrated games are
  never shown (`rated=true`).
- The year is loaded as a whole: `listAllGames` walks pages of `ALL_GAMES_PAGE_SIZE` (200).
- `YearNavigator` sits centered above and below the grid. It has an older/newer IconButton on each side of a
  single-select year Select, and both copies share one state. The top copy is the first row of
  `MediaViewHeader` (`controlsLayout="center"`, no search row). Its results bar shows the number of ranked
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
