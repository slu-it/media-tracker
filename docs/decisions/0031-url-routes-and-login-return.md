# 0031: URL routes for media kinds and sub-pages, view state in the query, login returns to the deep link

Status: accepted, 2026-10

## Context

Every view was reachable only by clicking. The media tab and the games sub-page were localStorage-backed state
(`mt.mediaTab`, `mt.gamesPage`), and search, filters, sort, page and ranking year were component state. A view
could not be bookmarked, shared, reloaded with its filters, or stepped through with the browser's Back button.
Record 0030 left this open: "Deep links to a sub-page do not exist. They would come with a router." Record 0008
had decided "no router". This record supersedes both of those points. The backend
already served `index.html` for every unknown authenticated path. But the session challenge redirected to a bare
`/login`, and a login always landed on `/`.

## Decision

- **React Router in declarative mode.** We use the `react-router` package (major 8), not `react-router-dom` and
  not the data or framework modes. `<BrowserRouter>` sits in `main.tsx`, outside `AppProviders`, so tests wrap
  in `MemoryRouter` through `renderWithProviders(ui, { route })`.
- **Paths are derived from `MEDIA_KINDS` and `MEDIA_SUB_PAGES`** (`src/routes.ts`), never written out:
  - A kind with sub-pages has `/{kind}/{subPage}`, for example `/games/watchlist`. `/{kind}` alone redirects to
    its last-used sub-page.
  - A kind without sub-pages is `/{kind}`.
  - `/` redirects to the last-used kind. Any other path redirects to `/`.
  - All three redirects replace the history entry.
- **localStorage only remembers where to land.** The current route writes the existing keys `mt.mediaTab` and
  `mt.gamesPage`. They are read only for the `/` and `/{kind}` redirects, so existing users keep their last view.
- **The URL query is the view state.** Each view parses and serializes it through pure codecs in
  `features/games/domain/gameViewParams.ts`.
  - Params: `search`, repeatable `platform`, `ownership`, `progress` and `year`, plus `sort` and `page`.
  - Defaults and empty values are omitted. Keys and values are written in a fixed order, so equal state gives an
    equal URL.
  - Values that are invalid, or that the backend would reject with a 400 (out-of-range years, non-UUID
    platforms, too many values, an over-long search), are dropped silently.
  - The search box stays local state and writes its debounced value. A URL change from outside (Back, a link)
    re-syncs the box.
- **Back steps through views and pages, not keystrokes.**
  - Push: a tab switch, a page change, a ranking year change.
  - Replace, dropping `page`: a debounced search, a filter or a sort change.
  - Replace: automatic page corrections (a reload that leaves a later page empty).
  - Tab links carry no query, so a sub-page starts with clean filters, as before.
- **Login returns to the deep link.**
  - The session challenge redirects a browser navigation to `/login?returnTo=<encoded uri>`. The query is
    omitted for `/`. The SPA's 401 handling does the same with the current location.
  - The login form has no `action`, so it posts to its own URL and the query survives without templating.
  - A successful login, and the bounce of a logged-in user away from `/login`, go to the target. A failed login
    keeps it.
  - `safeReturnPath` (`auth/api/ReturnPath.kt`) accepts only a relative path with exactly one leading `/`. It
    rejects a backslash, control characters, spaces and anything outside printable ASCII, more than 2048
    characters, and `/login` or `/logout` targets. Those are compared case-insensitively on the path after
    percent-decoding, dropping `;` parameters and resolving dot segments. Anything else falls back to `/`, so the
    parameter cannot become an open redirect.

## Consequences

- Every view state is bookmarkable and survives a reload and a login.
- A new media kind or sub-page gets its routes from the two lists. A new view state belongs in the view's URL
  codec, not in `useState`.
- View tests assert URLs through the location probe (`currentLocation()`) and drive history with
  `HistoryControls`.
- One more runtime dependency, pinned exactly like the others.
- The open detail dialog is not part of the URL. A link to a single game would need a route of its own.

## Alternatives considered

- A hand-rolled hook on `history.pushState`/`popstate`: no dependency, but we would own link handling,
  Back/Forward and test support that the router already gets right.
- Pushing every change: Back would replay each filter toggle and debounced search.
- Keeping the query on tab switches: an overview filter such as `ownership` has no meaning on the watchlist, and
  clean sub-pages were the existing behaviour.
- A signed or server-side stored return target: unnecessary for a same-origin path that is validated on use.
