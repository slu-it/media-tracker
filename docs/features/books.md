# Books

ADRs: [0034](../decisions/0034-books-and-shared-media-building-blocks.md) (separate domain on shared media
building blocks), with [0009](../decisions/0009-game-platforms-as-reference-data.md) (types as seeded reference
data) and [0029](../decisions/0029-game-release-date-and-developers.md) (release date, authors as vocabulary)
applied to books.
Code: `backend/src/main/kotlin/de/sluit/mediatracker/books/`, `frontend/src/features/books/`, migration
`V012__books.sql`.

Books is the second media kind. Its first version is the games overview equivalent: add, edit, delete and a
paged, searchable, filterable list at `/books/overview`, plus MCP tools. There are no watchlist or ranking
sub-pages, no rating, no hidden flag, no expansions and no cover picker yet.

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
| `POST /api/books` | Create (201); `releaseYear` may be omitted when `releaseDate` is given; `typeIds`/`authorIds` default to `[]` |
| `PATCH /api/books/{id}` | `PatchField` for description, cover URL and date (`null` clears); `typeIds`/`authorIds` replace the set |
| `DELETE /api/books/{id}` | 204 |
| `GET /api/books.meta` | Filter values in use: types, ownership, progress, release years (newest first) |
| `GET /api/book-types` | The seeded types |
| `GET`/`POST /api/book-authors` | Lookup (`search`, `limit` 1..50, default 10) and idempotent create (201 new, 200 existing) |

Search matches the title only, as for games (ADR 0033): a fulltext prefix term or `title LIKE 'term%'`, prefix
hits first (`common/persistence/TitleSearch.kt`).

## MCP tools

`list_book_types`, `add_book`, `search_books` (query and/or filters `typeIds`, `ownership`, `progress`,
`releaseYears`, agent-only `hasMissing` with `description`/`coverImageUrl`, `pageSize` default 10, maximum 100),
`update_book` (description, cover URL and date clearable with `null`), `search_book_authors` and
`create_book_author`. Agents look up authors first, create missing ones, then add or update the book with
`authorIds`. There is no delete tool, as for games.

## Frontend

- `BooksView.tsx` is the overview: search row, results row with the count chip and `BookOverviewFilters`
  (progress and ownership toggle bars, Type and Release year selects), grid of `BookCard`s, pagination top and
  bottom, FAB and dialogs through `BookDialogsHost`. URL state lives in `domain/bookViewParams.ts` (`search`,
  `type`, `ownership`, `progress`, `year`, `page`); page size `BOOKS_PAGE_SIZE` = 36.
- The `reading` progress icon is `AutoStories`; the others match games (`NotStarted`, `Pause`, `TaskAlt`,
  `NotInterested`), as do the ownership icons. Cards show the ownership icon for watchlist books and the
  progress icon for owned ones.
- The release-year select reaches back to 1450 (`BOOK_RELEASE_YEAR_SELECT_MIN`, passed as `minYear` to the shared
  `ReleaseYearField`; games keep 1980).
- Book covers use a 2:3 frame (`BOOK_COVER_ASPECT_RATIO` in `domain/bookValues.ts`), passed to the shared
  `CoverImage`, `MediaCardShell` and `MediaGrid`.
- `BookDetailDialog` mirrors the game dialog: view mode with quick ownership and progress PATCHes, edit with
  `BookForm`, delete with confirmation. New authors typed in `AuthorsField` are created on save before the book
  (`resolveAuthorIds`).
- Everything kind-neutral is shared, see [games.md](games.md#shared-media-building-blocks).
