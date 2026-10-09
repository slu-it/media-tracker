# 0038: Book watchlist as filter plus release sort, with a shared sort toggle

Status: accepted, 2026-10

## Context

Games have a watchlist sub-page (0030): the list filtered to `ownership = watchlist`, sorted by release with an
"Oldest first" / "Newest first" toggle, narrowed by a platform select. Books needed the same page. `GET /api/books`
had the ownership filter but no `sort`; it always ordered by title (0034).

## Decision

- `/books/watchlist` follows 0030 as is: no dedicated endpoint, the view fixes `ownership=watchlist` and passes a
  release sort to the existing list. The book types select takes the place of the platform select.
- `GET /api/books` and `search_books` take `sort=title|release_asc|release_desc` (`BookSort`, default `title`),
  with the game ordering: release year, dated before year-only within a year, date, title, id; a non-default
  sort overrides search relevance. There is no `rating_desc`, books have no rating. The enum stays per kind
  (0034), the release ordering is shared with the authors view's book list.
- `ReleaseSortToggle` moves to `components/media/` and its labels to `media.sort.*`, since both kinds use it.
  The cards stay per kind (`WatchlistGameCard`, `WatchlistBookCard`), as 0034 keeps cards explicit.

## Consequences

- The watchlist is the second books tab: overview, watchlist, authors, series.
- A movies or series watchlist adds a `<Kind>Sort` with the release values and reuses the toggle.
