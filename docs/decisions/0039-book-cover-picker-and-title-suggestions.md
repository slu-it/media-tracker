# 0039: Book covers and title suggestions from Open Library and Audible, on shared cover building blocks

Status: accepted, 2026-10

## Context

Games pick covers and get title suggestions from SteamGridDB (records 0024, 0026). Books had only a hand-typed
cover URL. SteamGridDB has no books, so books need their own sources:

- No free official API covers audiobooks. Goodreads closed its API in 2020. Amazon's Product Advertising API
  needs an affiliate account, and ISBNdb is paid.
- **Google Books** returns one small thumbnail per volume.
- **Hardcover** is a beta API with a personal token that may be reset without notice.
- **Open Library** is keyless and lists several covers per work across its editions. It has nothing for
  audiobooks.
- **The Audible catalog** (`api.audible.<marketplace>/1.0/catalog/products`) has the best audiobook data, with
  narrators and high-resolution square covers. It is keyless but unofficial and undocumented. Audiobookshelf and
  Audnexus rely on it.

Books have no ISBN, so every lookup is by title. Audiobooks are not a separate kind. They are books with the
seeded `Audible` type and, usually, narrators (record 0035).

## Decision

### Sources
- **Two keyless sources, both always on:**
  - Open Library for printed and e-books (`book`).
  - Audible for audiobooks (`audiobook`), marketplace `AUDIBLE_MARKETPLACE`, default `de`.
- **Config:** base URLs, the Open Library covers host and the User-Agent can be configured under
  `bookCoverSource.*`.
- **No `503` path:** without a key there is no "unconfigured" state, so books never return `503`.

### Choosing the source
- **A `book`/`audiobook` toggle chooses the source.** It works like the games static/animated toggle.
- **The default** is `audiobook` when a selected type is `Audible` or narrators are set, otherwise `book`.
- **Title suggestions** use the same derived source without a toggle.
- Merging both sources was rejected: twice the latency, mixed ranking and mixed aspect ratios in one grid.

### Open Library (match model, like games)
- `search.json` finds works, and the shared `selectBestMatch` picks one among the works that have a cover. If none
  has one, it picks among all of them. Without that filter an obscure work with the exact title but no cover
  (Open Library's "Der Hobbit") beat Tolkien's "The Hobbit" with hundreds of edition covers.
- That work's covers are the deduplicated union of the work's own covers and the covers of up to 1000 editions,
  fetched in one `editions.json` call. Editions bring in German and other local covers.
- The covers list is paged in memory. A `match` (`OL…W`) overrides the pick.
- Every request sends an identifying User-Agent, as Open Library asks.

### Audible (flat model)
- Each product is one cover, so there are no matches.
- Covers are the product images of an Audible `keywords` search, using Audible's own paging (0-based, at most 50
  per page). `title=` was too strict.
- `match` with `source=audiobook` is a `400`.

### Failures
- An upstream failure is a `502` with the source's own code: `open_library_error` or `audible_error`.
- Title suggestions degrade to `[]`, as in record 0026.

### Suggestions
- At most 8, deduplicated by title and first author. They are shown with authors and year.
- Search starts from 3 characters, because short book titles are common.
- A pick always sets the title. It fills the year, the authors and, from Audible, the narrators only when they
  are empty.

### Shared building blocks and storage
- **Shared, not per kind (record 0034):**
  - Backend: `CoverOption` (width and height now nullable), `RankableMatch` with `selectBestMatch`, the cover
    page response and the external HTTP client.
  - Frontend: `CoverPickerDialog`, `CoverThumbnail`, `useCoverOptions`, `useTitleSuggestions` and
    `SuggestingTitleField`.
- **Per kind:** match id types, ports, services, routes and MCP tools. Games and books keep thin wrappers.
- **Storage:** URLs stay external hotlinks, as in record 0024.
- **MCP:** a `find_book_cover` tool mirrors `find_game_cover`.

## Consequences

- **Audible may break without notice.** The adapter is the only place that knows its shape. A change shows up as
  `502 audible_error` in the picker and empty suggestions in the form, while Open Library keeps working.
- **Open Library is slow and patchy for German editions**, but it needs no account.
- **Upstream cost:** the first picker page costs three Open Library calls (search, work, editions). Later pages
  with a match skip the search and cost two. Nothing is cached. Each typing pause costs one search on the chosen source.
- **Audible covers are square** and are letterboxed in the 2:3 book frame.
