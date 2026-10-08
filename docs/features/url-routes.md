# URL routes and deep links (MT-032)

ADR: [0031](../decisions/0031-url-routes-and-login-return.md). It supersedes the "no router" parts of
[0008](../decisions/0008-frontend-ui-stack.md) and [0030](../decisions/0030-game-sub-pages-sort-and-rated-filter.md).

Code:
- Frontend:
  - `src/routes.ts`: paths derived from `MEDIA_KINDS` and `MEDIA_SUB_PAGES`, plus the stored-route helpers.
  - `hooks/useActiveRoute.ts`, and `App.tsx` (the `<Routes>`).
  - `BrowserRouter` in `main.tsx`.
  - `src/domain/media/viewParams.ts`: the kind-neutral field codecs; `features/games/domain/gameViewParams.ts`
    and `features/books/domain/bookViewParams.ts`: each view's query codec.
  - `src/hooks/useUrlSearchInput.ts`: the search field ⇄ `search` sync shared by every view with a search.
  - `src/hooks/useViewParams.ts`: the URL writer. React Router hands a functional
    `setSearchParams` the render-time params, so two writes in one commit would overwrite each other. The hook
    merges each update onto the latest written params.
  - The three games views, `BooksView`, and `api/client.ts` (401 → `returnTo`).
- Backend: `auth/api/ReturnPath.kt` (`safeReturnPath`, `loginUrl`), `auth/api/Security.kt` (the challenge),
  `auth/api/LoginRoutes.kt`, and `login/login.html` (a form without `action`).
- Tests: `src/routes.test.ts`, `App.test.tsx`, the "URL state" tests of each games view, `gameViewParams.test.ts`.
  Backend: `ReturnPathTest`, `AuthRoutesTest` and `RoutesTest`.

## Routes

| Path | Query (omitted when default or empty; `*` = repeatable, `?k=a&k=b`) |
|---|---|
| `/books/overview` | `search`, `type`* (ids), `ownership`*, `progress`*, `year`*, `page` (ADR 0034) |
| `/movies`, `/series` | none |
| `/games/overview` | `search`, `platform`* (ids), `ownership`*, `progress`* (API values), `year`* (release-year filter), `page` |
| `/games/watchlist` | `search`, `platform`*, `sort=release_desc` (`release_asc` is the default), `page` |
| `/games/ranking` | `year` (the ranked year; absent = the default year of record 0030) |
| `/` | redirects to the last-used kind (`mt.mediaTab`, default `books`), including its last sub-page |
| `/books`, `/games` | redirect to the kind's last-used sub-page (`mt.booksPage`, `mt.gamesPage`, default `overview`) |
| anything else | redirects to `/` |

- Redirects replace the history entry. The current route keeps writing `mt.mediaTab` and the kind's sub-page key.
  Those keys are read only for the redirects.
- The codec writes keys in a fixed order (search, platform, ownership, progress, year, sort, page) with sorted
  values, so equal state gives an equal URL.
- Values the backend would reject with a 400 are dropped silently, so a hand-edited or stale link never shows a
  load error:
  - unknown enum values, and a watchlist `sort` other than the release ones;
  - years outside the release-year range, and platform ids that are not UUIDs;
  - more values per filter than the backend allows, and a search over its maximum length;
  - a `page` below 1 or above the 32-bit range.
- Paths match case-sensitively, the `/{kind}` redirects included: `/GAMES` and `/GAMES/overview` redirect to `/`.
- Platform ids are lowercased, like the backend's UUIDs, so an uppercase id still selects its platform.
- On the ranking, a year that is not offered falls back through `resolveRankingYear`, as before. The URL keeps
  the requested year. Until `/api/games.meta` has loaded, the linked year is used as is, so a deep link does not
  load the current year first.

## History

- **Push**: a media or sub-page tab click (to the bare path, so filters start clean), a page change, a ranking
  year change.
- **Replace, dropping `page`**: the debounced search, a filter, the watchlist sort.
- **Replace**: the automatic page correction of `usePagedActions`, when a reload or a delete leaves a later
  page empty. Its `setPage(page, { replace: true })` is the convention for any correction; user navigation calls
  it without the option. The correction only acts on data of the current request (`!loading && data.page ===
  page`), so Back to a page entry is never rewritten from the previous query's stale data.
- **Scroll**: only the user's page click scrolls the window to the top (`PaginationBar`). Corrections,
  refinements and Back/Forward leave the scroll position alone. Back/Forward relies on the browser's own scroll
  restoration, which works because the previous page's grid stays rendered while the next one loads, so the
  document height survives the popstate (jsdom cannot check this; verify by eye).
- The search field stays local state, initialised from `search` (`useUrlSearchInput`). Its debounced value is
  written back; Enter (`flushSearch`) and the clear button (`clearSearch`) write at once. A `search` change from
  outside (Back, a link) re-syncs the field without a write-back.

## Login return

- The challenge for a browser navigation without a session redirects to `/login?returnTo=<encoded uri incl.
  query>`. For `/` it is a plain `/login`.
- A 401 from `apiFetch` does the same with `location.pathname + location.search`.
- The form posts to its own URL. A successful login redirects to the validated target, else `/`.
- A failed login redirects to `/login?error=1&returnTo=…`.
- A logged-in `GET /login?returnTo=…` bounces to the target.
- `safeReturnPath` accepts only a relative path with exactly one leading `/`. It rejects a backslash, control
  characters, spaces and anything outside printable ASCII, more than 2048 characters, and `/login` or `/logout`
  targets (compared case-insensitively on the path after percent-decoding, dropping `;` parameters and
  resolving dot segments).

## Testing

- `renderWithProviders(ui, { route })` wraps the UI in `MemoryRouter` and renders a hidden location probe, which
  `currentLocation()` (`src/test/currentLocation.ts`) reads.
- `src/test/HistoryControls.tsx` renders Back and Forward buttons (`navigate(-1)` / `navigate(1)`).
  `window.history` does nothing under `MemoryRouter`.
