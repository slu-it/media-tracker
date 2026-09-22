# 0021: Filtering the game list, and `.meta` endpoints for the values to filter by

Status: accepted, 2026-09 (the release-year order was reversed to newest first in MT-014)

## Context

MT-003 gave `GET /api/games` a fulltext `?search=`, and `GameService.list` branches on it: no term means the plain
listing ordered by title, a term means the relevance-ordered fulltext query (record 0015). MT-007 added
`ownership`, `progress` and `hidden` and closed with "a later filter story adds the index together with the query"
(record 0017). This is that story, minus `hidden`, which nobody has asked to filter on yet.

The list now narrows by four things at once - platform, ownership, progress and release year - each a multi-select.
Two of the four have values that only the database knows: platforms are seeded reference data and years exist only
where games do. So the frontend needs somewhere to read the selectable values from, and the answer could not be
`GET /api/game-platforms`: that endpoint is *all* platforms, which is what the add/edit dialogs need, and it says
nothing about ownership, progress or years.

## Decision

- **Filters take the search branch.** `GameService.list(request, search, filters)` calls `findPage` only when
  there is neither a term nor a filter, and `GameRepository.search(term, filters, request)` otherwise, with a
  nullable term. One query builder handles term-only, filter-only and both, so the ordering rules stay in one
  place: with a term the relevance order of record 0015, without one the plain `title, id` order. The alternative
  - a third repository method for "filtered listing" - would have duplicated the platform loading, the paging and
  the count for no behavioural difference.
- **OR inside a filter, AND across filters.** Two selected platforms mean "on either", a selected platform plus a
  selected progress means "both". This is what a set of independent dropdowns reads as, and it is the only
  combination that keeps every control's effect monotone: adding a value to one filter can only widen, adding a
  filter can only narrow.
- **The platform filter is a semi-join, not a join.** `games.id IN (SELECT game_id FROM game_to_platform WHERE
  platform_id IN (...))`. Joining the junction table would return a game once per matching platform and silently
  corrupt both `totalItems` and the `LIMIT/OFFSET` window - the failure would look like "paging is slightly off"
  rather than like a wrong query, so it has its own repository test.
- **`GET /api/games.meta` is the endpoint for a resource's filter values,** and `.meta` is the convention to
  repeat: `<resource>.meta` is a sibling path of `<resource>`, inside the same auth tier, returning the lookup
  data a client needs to *talk about* the resource rather than the resource itself. A dot instead of
  `/games/meta` keeps the id space clean - no id can ever collide with a sub-path.
- **`GET /api/game-platforms` stays.** It is reference data with its own life (record 0009) and a management UI
  will need it, all of it, including platforms no game uses yet. `games.meta`'s platform list is a different
  question with a different answer.
- **The meta endpoint only offers values that occur in the stored games,** all four of them, so no selection can
  produce an empty result. Ordering is decided in the domain, not in SQL and not in the frontend: platforms
  alphabetically by label (`findAll` already is), ownership and progress in the order the enums declare them in
  `GameStatus.kt`, years newest first (ascending until MT-014 - the recent years are the ones worth reaching).
  `GameService.meta` therefore filters `Ownership.entries` by what is in use rather than sorting what the database
  returned.
- **Ownership and progress travel as their wire strings**, not as `{value, label}` pairs. The labels are
  translated and the backend has no i18n bundle; the frontend already renders `games.ownership.*` /
  `games.progress.*` for the status icons and the edit form.
- **Query parameters are repeatable and named after the domain constants** (`platformIds`, `ownership`,
  `progress`, `releaseYear`), so the parameter, the DTO field and the field named in a 400 body are one string.
  An unknown value is an `InvalidValueException` like any other bad input.
- **Three single-column indexes** (`V007`), on `ownership`, `progress` and `release_year`. Honest reason: for the
  list query MariaDB will often ignore the first two - `ownership` has two distinct values and `progress` six -
  and the platform filter is already served by `idx_game_to_platform_platform` from V002. They pay for themselves
  on the meta endpoint, where each `SELECT DISTINCT <column> FROM games` becomes an index scan instead of a table
  scan, and on `release_year`, which is selective enough to help the list query too.
- **`search_games` gains the same four filters** and its `query` becomes optional, because an agent asking "what
  am I playing on the Switch" has filters and no search term. A call with neither a query nor a filter is an
  error result rather than a silent full listing.

## Alternatives not taken

- A separate `GET /api/games?filterValues=true` or a `meta` field on the paged response: both make the list
  endpoint return two unrelated things, and the second recomputes four `DISTINCT` queries on every page turn.
- Comma-separated values in one parameter (`?ownership=owned,watchlist`): needs an escaping rule the moment a
  value could contain a comma, and `URLSearchParams`/Ktor both handle repetition natively.
- Offering every enum value and every seeded platform regardless of use: simpler queries, but then most of the
  menu leads to "no games match", which is exactly what a filter is supposed to prevent.
- Putting the filter state in the URL as query parameters of the SPA route: worth doing when the app gets
  shareable links, but it would be the first router state in the project and is not needed to filter a list.
- Keeping the `x - y of z` caption and letting the row wrap: the caption is the least useful thing in a row that
  now holds five controls, and MUI caps the page buttons with `boundaryCount`/`siblingCount` natively.

## Consequences

- The next media kind copies the same three pieces: a `<Kind>Filters` domain type, a `search(term, filters, …)`
  repository method, and a `<kind>.meta` endpoint. If a kind ever needs a filter whose values are expensive to
  derive, `.meta` is the place to cache, not the list endpoint.
- `hidden` is still not a filter and hidden games are still listed. When that story comes it is one more field on
  `GameFilters` and one more entry in the meta payload - or, more likely, a plain toggle rather than a
  multi-select, since it is a boolean.
- `GameRepository.search` now takes a nullable term, so a search string that consists only of fulltext operators
  ("+++") falls back to the *filtered* listing instead of the unfiltered one.
- The frontend keeps two platform sources on purpose: `useGamePlatforms` (all platforms, for the dialogs) and
  `useGamesMeta` (platforms in use, for the filter). Because adding a game can introduce a year or platform no
  other game has, `GamesView` reloads the meta after every create, update and delete, next to the page reload it
  already did.
