# 0030: Sub-pages per media kind, and a sort and a rated filter on the game list

Status: accepted, 2026-09

## Context

The games tab gets two views beside the existing overview: a watchlist (games whose ownership is `watchlist`),
sorted by release, and a yearly ranking (the rated games of one year, best first). Both need orderings the list
did not offer: until now it was ordered by title, or by relevance with a search term. The ranking also has to
leave unrated games out. The app has no router, and the media tab is a localStorage-backed state (`mt.mediaTab`).

## Decision

- **One list endpoint, two more parameters.** `GET /api/games` takes `sort` (`title` default, `release_asc`,
  `release_desc`, `rating_desc`, the `GameSort` enum in the games domain) and `rated=true|false`
  (`GameFilters.ratedOnly`, `rating IS NOT NULL`). An unknown value is a 400, a blank one counts as absent
  (like a blank `search`), and a repeated `sort` or `rated` keeps the first value, like `page`. The MCP tool
  `search_games` takes the same two arguments, and its schema enum is derived from `GameSort.entries`. There is
  no dedicated watchlist or ranking endpoint: both views are filter + sort combinations of the existing list.
- **Release order is year first, then date, with dated games before year-only ones.**
  - `release_asc` is `release_year, release_date IS NULL, release_date, title, id`.
  - `release_desc` reverses the first three parts; `title, id` stay ascending as the tiebreak.
  - `release_year` is always the effective year, because the domain derives it from a set date (record 0029).
  - `rating_desc` is `rating DESC, title, id`.
  - A non-default sort replaces the relevance order when a search term is given. The term still filters. The
    default `title` keeps the relevance order of record 0015.
- **No new indexes.** The filtered sets (one ownership value, one year) are small, and a filesort on them is
  cheap.
- **Sub-pages are a second tab row, not routes.**
  - `MEDIA_SUB_PAGES` in `components/layout/mediaKinds.ts` lists the sub-pages of a kind, and only kinds with an
    entry show the second row.
  - The chosen sub-page is stored per kind in localStorage (`mt.gamesPage`), the same way as the media tab.
  - Introducing a router for three views of one kind would change every existing view and test for no gain.
- **The ranking loads the whole year, not a page.** The frontend loops over pages of 200 until `totalPages`.
  It navigates between years instead of pages. The years offered are `/api/games.meta` `releaseYears` up to the
  current year, plus the current year, which is where the page starts.

## Consequences

- Books, Movies and Series add sub-pages by adding an entry to `MEDIA_SUB_PAGES` and a view per entry.
- A new ordering is one more `GameSort` entry: the REST parsing and the MCP schema follow from the enum.
- A year with thousands of rated games would need several requests. That is acceptable for a personal
  collection.
- Deep links to a sub-page do not exist. They would come with a router.

## Alternatives considered

- Dedicated `/api/games/watchlist` and `/api/games/ranking` endpoints: they duplicate the filter and paging logic
  that `search` already has, and agents would need two more tools.
- A client-side sort of one page: it is wrong as soon as the watchlist has more than one page.
- An effective-year expression (`COALESCE(YEAR(release_date), release_year)`) in the order: redundant, because
  the domain keeps `release_year` consistent with the date.
