# 0034: Books as the second media kind, on shared media building blocks with per-kind status enums

Status: accepted, 2026-10

## Context

Books is the second media kind after games. Its first version covers the games overview: add, edit and delete,
a paged list with title search, and filters for progress, ownership, type and release year, plus MCP tools.
The book model is close to the game model: title, description, a user-created vocabulary (authors instead of
developers), release year and optional release date, seeded reference data (types instead of platforms),
ownership, progress and a cover URL. It has no rating, no hidden flag and no expansions.

Until now games was the template: a new kind copies the `games` package on both sides. Copying the generic parts
too (toggle bars, filter selects, search, paging, the vocabulary autocomplete, the value classes, the fulltext
and vocabulary persistence) would duplicate a few thousand lines that then drift. Merging the two domains would
break the separation the owner wants: books and games must be able to evolve independently.

Record 0017 expected the next kind to share the ownership and progress enums and suggested moving them to
`common/domain`. The book value sets differ: ownership has no `subscription`, progress has `reading` instead
of `playing` and no `completed` (there is no 100 % of a book).

## Decision

- **Each kind keeps its own domain, API, persistence, MCP tools and explicit frontend components.** Books gets
  `books/{domain,api,persistence}`, `BookMcpTools.kt`, its own tables and `features/books/` with `BookCard`,
  `BookForm`, `BookDetailDialog`, `BookProgressToggleBar` and so on.
- **Kind-neutral code is shared, not copied.**
  - Backend: `common/domain` holds the media value classes (`Title`, `Description`, `ReleaseYear`,
    `ReleaseDate`, `CoverImageUrl`, `HexColor`), the date-beats-year rules (`ReleaseDating.kt`), `WireEnum` and
    the vocabulary values. `common/persistence` holds the fulltext helpers, the title match and the idempotent
    name vocabulary (`ExposedNameVocabulary`). `common/api` holds query-parameter and MCP argument and schema
    helpers.
  - Frontend: `src/components/media/` holds the generic UI (status toggle and filter bars, `FilterSelect`,
    search field, results bar, view header, pagination, grid, card shell, cover-and-info layout, generic fields
    including the create-on-the-fly `VocabularyField`), `src/domain/media/` the validators and URL codecs,
    `src/hooks/` the shared hooks.
- **Status enums stay per kind.** `BookOwnership` (`watchlist`, `owned`) and `BookProgress` (`abandoned`,
  `not_started`, `paused`, `reading`, `finished`) live in `books/domain/BookStatus.kt`. Only the `wire`/`from`
  mechanism (`WireEnum`) is shared. This amends the consequence in record 0017.
- **Book types follow record 0009, but are optional.** `book_types` is seeded with fixed UUIDs (Hardcover,
  Paperback, Kindle, Audible, each with a colour) and linked through `book_to_type`. A book may have no type,
  for example a watchlist book whose format is not decided yet.
- **Authors follow record 0029** (`book_authors`, `book_to_author`, idempotent case- and accent-insensitive
  create, prefix fulltext lookup, created by the client before the book is saved), on the shared vocabulary
  persistence.
- **i18n: shared `media.*` keys plus props.** Kind-neutral strings (field labels, "-all-", clear, no cover) live
  under `media.*`. Kind-specific strings (counts, empty states, value labels) stay under `games.*`/`books.*`
  and are passed to shared components as already translated props. Shared components never build a key from a
  kind name.
- **The cover frame ratio is a parameter.** Games keep 22:31, books use 2:3. `coverHeight` and the shared cover
  components take the ratio; games pass nothing and get the default.
- **Books gets the sub-page tab row with a single "Overview" tab** (`/books/overview`), so later sub-pages slot
  in without a URL change.

## Alternatives not taken

- **Copying the games package wholesale**, as record 0007 described: fastest for books, but every later fix to a
  toggle bar or filter would have to be made in each kind.
- **One generic media domain with a `kind` column**: the kinds differ in fields, vocabularies and statuses, and
  the owner wants them separate.
- **Shared ownership and progress enums with per-kind subsets**: the subsets would have to be enforced
  everywhere anyway, and a games-only value would leak into the book API and MCP schemas.
- **Shared components that take a `kind` and build i18n keys from it**: couples shared code to every kind's key
  layout and loses the typed-key check at the call site.

## Consequences

- A new kind now reuses the shared pieces and writes only its own domain, tables, DTOs, MCP tools, cards,
  dialogs and wrappers. `docs/features/games.md` and `books.md` describe what is shared.
- Changing a shared component changes every kind. Its tests live next to it, the kinds' integration tests cover
  the composition.
- `/` now lands on `/books/overview` (books is the default kind), so the start page loads data.
