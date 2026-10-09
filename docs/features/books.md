# Books

ADRs: [0034](../decisions/0034-books-and-shared-media-building-blocks.md) (separate domain on shared media
building blocks), with [0009](../decisions/0009-game-platforms-as-reference-data.md) (types as seeded reference
data) and [0029](../decisions/0029-game-release-date-and-developers.md) (release date, authors as vocabulary)
applied to books, and [0035](../decisions/0035-book-series-and-narrators.md) (series with a position per link,
narrators like authors, MT-042). The series view (MT-043) and the authors view (MT-046) need no record of
their own.
Code: `backend/src/main/kotlin/de/sluit/mediatracker/books/`, `frontend/src/features/books/`, migrations
`V012__books.sql`, `V013__book_series_and_narrators.sql`.

Books is the second media kind. Its first version is the games overview equivalent: add, edit, delete and a
paged, searchable, filterable list at `/books/overview`, plus MCP tools. Two more sub-pages list books by group:
`/books/authors` (MT-046) by author, `/books/series` (MT-043) by series in order. There are no watchlist or
ranking sub-pages, no rating, no hidden flag, no expansions and no cover picker yet.

## Domain

- A book has a title, a required release year, an optional release date, an optional description and an
  optional external cover URL. When a date is set, its year is the book's year, with the same rules as games
  (`common/domain/ReleaseDating.kt`).
- **Types** come from the seeded `book_types` table (fixed UUIDs, hex colours) through `book_to_type`:
  Hardcover `5D4037`, Paperback `00796B`, Kindle `1A73B5`, Audible `F7991C`. Unlike platforms, types are
  optional: a book may have none. `GET /api/book-types` lists them by label.
- **Authors** are a user-created vocabulary in `book_authors` through `book_to_author`, built on the shared
  `ExposedNameVocabulary`: unique case- and accent-insensitive names of at most 128 characters, idempotent create,
  prefix plus fulltext lookup. Authors nobody references are kept.
- **Narrators** (MT-042) work exactly like authors, in `book_narrators` through `book_to_narrator`. They are
  meant for audiobooks but can be set on any book.
- **Series** (MT-042) are the same kind of vocabulary in `book_series`, linked through `book_to_series`, which
  carries an optional `position DECIMAL(6,2)` (`BookSeriesPosition`: 0 to 9999.99, at most two decimals, so
  novellas can be #2.5 and prequels #0). A book is in a series at most once, and may be in several, each with its
  own number (ADR 0035).
- Authors, narrators and series of a book are ordered by name.
- **Ownership** `watchlist | owned` and **progress** `abandoned | not_started | paused | reading | finished`
  are `BookOwnership` and `BookProgress` in `books/domain/BookStatus.kt` (declaration order is display order;
  defaults `watchlist` / `not_started`). There is no `subscription` and no `completed` (100 %). Both use the
  shared `WireEnum`; they are not shared with games (ADR 0034).
- The value classes (`Title`, `Description`, `ReleaseYear`, `ReleaseDate`, `CoverImageUrl`, `HexColor`) are the
  shared ones in `common/domain/MediaValues.kt`.

## REST

| Method and path | Purpose |
|---|---|
| `GET /api/books?page=&pageSize=&search=&typeIds=&ownership=&progress=&releaseYear=` | Paged list; the four filters repeat, OR within, AND across; the type filter is a semi-join |
| `POST /api/books` | Create (201); `releaseYear` may be omitted when `releaseDate` is given; `typeIds`/`authorIds`/`narratorIds`/`series` default to `[]`; `series` is `[{seriesId, position?}]`, a repeated `seriesId` is a 400 |
| `PATCH /api/books/{id}` | `PatchField` for description, cover URL and date (`null` clears); `typeIds`/`authorIds`/`narratorIds`/`series` replace the set |
| `DELETE /api/books/{id}` | 204 |
| `GET /api/books.meta` | Filter values in use: types, ownership, progress, release years (newest first) |
| `GET /api/book-types` | The seeded types |
| `GET`/`POST /api/book-authors` | Lookup (`search`, `limit` 1..50, default 10) and idempotent create (201 new, 200 existing) |
| `GET`/`POST /api/book-narrators` | As `/api/book-authors` |
| `GET`/`POST /api/book-series` | As `/api/book-authors`; `BookResponse.series` is `[{id, name, position}]` |
| `GET /api/book-series.summaries` | Every series, those without books included, as `[{id, name, bookCount}]` by name; unpaged (MT-043) |
| `GET /api/book-series/{id}/books` | The series' books, unpaged: by position, books without one last, then by title; 404 for an unknown series |
| `GET /api/book-authors.summaries` | Every author, those without books included, as `[{id, name, bookCount}]` by name; unpaged (MT-046) |
| `GET /api/book-authors/{id}/books` | The author's books, unpaged: by release year, then release date (books without one last), then title; 404 for an unknown author |

Search matches the title only, as for games (ADR 0033): a fulltext prefix term or `title LIKE 'term%'`, prefix
hits first (`common/persistence/TitleSearch.kt`).

## MCP tools

`list_book_types`, `add_book`, `search_books` (query and/or filters `typeIds`, `ownership`, `progress`,
`releaseYears`, agent-only `hasMissing` with `description`/`coverImageUrl`, `pageSize` default 10, maximum 100),
`update_book` (description, cover URL and date clearable with `null`), `search_book_authors`,
`create_book_author`, `search_book_narrators`, `create_book_narrator`, `search_book_series` and
`create_book_series`. Agents look up authors, narrators and series first, create missing ones, then add or update
the book with `authorIds`, `narratorIds` and `series` (`[{seriesId, position?}]`, replaced as a whole on update). There is no delete tool, as for games.

## Frontend

- `BooksView.tsx` is the overview: search row, results row with the count chip and `BookOverviewFilters`
  (progress and ownership toggle bars, Type and Release year selects), grid of `BookCard`s, pagination top and
  bottom, FAB and dialogs through `BookDialogsHost`. URL state lives in `domain/bookViewParams.ts` (`search`,
  `type`, `ownership`, `progress`, `year`, `page`); page size `BOOKS_PAGE_SIZE` = 36.
- The `reading` progress icon is `AutoStories`; the others match games (`NotStarted`, `Pause`, `TaskAlt`,
  `NotInterested`), as do the ownership icons. Cards show the ownership icon for watchlist books and the
  progress icon for owned ones.
- The overview card (`BookCard` without `seriesPosition`, used by the overview and the authors view) shows one
  series under the title as an outlined chip ("Wax and Wayne #1", or just the name; long names ellipsized): the
  book's primary series by the heuristic `primarySeries` (`domain/seriesLabel.ts`). The lowest position wins, an
  entry without a position ranks after every number, and ties go to the name. So a sub-series beats its umbrella
  ("Wax and Wayne #1" over "The Mistborn Saga #4" and the unnumbered "The Cosmere"). The detail dialog lists all
  series. The type chips follow with the card's regular gap (the same as between types and status icons). Series
  and types together are the card's description (`aria-describedby`). A book without series keeps one chip row's
  height empty above its types, so the series row lines up across a grid row.
- The release-year select reaches back to 1450 (`BOOK_RELEASE_YEAR_SELECT_MIN`, passed as `minYear` to the shared
  `ReleaseYearField`; games keep 1980).
- Book covers use a 2:3 frame (`BOOK_COVER_ASPECT_RATIO` in `domain/bookValues.ts`), passed to the shared
  `CoverImage`, `MediaCardShell` and `MediaGrid`.
- `BookDetailDialog` mirrors the game dialog: view mode with quick ownership and progress PATCHes, edit with
  `BookForm`, delete with confirmation. New authors, narrators and series typed in `AuthorsField`,
  `NarratorsField` and `SeriesField` are created on save before the book (`resolveAuthorIds`,
  `resolveNarratorIds`, `resolveSeries`). The form order is authors, narrators, series.
- `SeriesField` wraps the shared `VocabularyField` and adds one number input per selected series below the chips
  (`validateSeriesPosition`, `.` or `,` as decimal separator). A number survives when its pending chip is upgraded
  to an existing series. The detail view shows the series as unlabelled chips ("Mistborn #1", the number
  formatted for the active language; a `group` named "Series" for screen readers) between the title and the
  description; below the description, a two-column grid holds release date or year | types and authors |
  narrators. Each field keeps its column when its neighbour is empty; a row with both cells empty is dropped.
- Everything kind-neutral is shared, see [games.md](games.md#shared-media-building-blocks).
- **Series view** (MT-043, `BookSeriesView.tsx`, tab "Book series" / "Buchreihen" at `/books/series`): every series
  from `/api/book-series.summaries` as one `BookGroupAccordion` each, by name, with a book-count chip. The search
  field filters the loaded list in the browser (case- and accent-insensitive substring, `nameSearch.ts`); it is
  kept in the URL (`bookGroupViewParams.ts`) but sends no request. A section's books load only when it is
  expanded (`unmountOnExit`, `useGroupBooks`), in the backend's order, as the overview's `BookCard`s with a "#n"
  badge (`seriesPosition`, a filled chip in the theme's primary colour) centered above the cover for numbered
  books (the slot is kept empty for unnumbered ones, so covers in a row stay aligned; `MediaCardShell`'s
  `descriptionPlacement="top"`) instead of the series chips; its type chips stay in the card body. A series
  without books shows a message and loads nothing. Saving, adding or deleting a book in the dialogs reloads the
  counts and every open section.
- **Authors view** (MT-046, `BookAuthorsView.tsx`, tab "Authors" / "Autoren" at `/books/authors`, between the
  overview and the series view): the same view over `/api/book-authors.summaries` and
  `/api/book-authors/{id}/books`. Authors without books are listed too. A section shows the author's books by
  release year, as overview `BookCard`s (series chips, no badge). Both views are thin wrappers around `BookGroupsView`,
  which takes the summary and book loaders, the card renderer and the i18n prefix (`books.seriesView`,
  `books.authorsView`); the accordion is `BookGroupAccordion`, the books hook `useGroupBooks`.
