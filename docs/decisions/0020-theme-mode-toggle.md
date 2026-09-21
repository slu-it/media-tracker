# 0020: A light/dark toggle in the header, stored per browser

Status: accepted, 2026-09

## Context

Both surfaces of the app have carried a full dark palette since the beginning: `frontend/src/theme/theme.ts`
declares `colorSchemes.light` and `colorSchemes.dark`, and the hand-written login page
(`backend/src/main/resources/login/login.css`) mirrors the same seven colours. Both resolved the choice the
same way, through `prefers-color-scheme`, so the operating system decided and the user could not disagree with
it. The owner asked for a button in the header, beside the language selector, that actively switches the mode
and remembers the answer for that browser.

Two things had to be decided: how many states the button has, and where the answer lives - which also settles
whether the login page, a static file with no bundler and no framework, can follow it.

## Decision

- **Two states, light and dark, not three.** The button is a plain toggle showing the mode it would switch
  *to*: a moon while the app is light, a sun while it is dark. Until the first click the mode is MUI's
  `system`, so the OS hint decides exactly as before; the first click pins an explicit mode and there is no
  "follow the OS again" entry. A third state would have to be explained by a third icon for a setting almost
  nobody returns to, and clearing site data still resets it. The nearest neighbour, `LanguageMenu`, is a menu
  rather than a toggle because it has genuinely equal alternatives; two mutually exclusive states do not.
- **MUI owns the state, we own the key.** `theme.ts` moves from `cssVariables: { colorSchemeSelector: "media" }`
  to `"class"` - `media` makes `setMode` a no-op, MUI logs an error saying so - and `AppProviders` passes
  `defaultMode="system"`, `modeStorageKey={MODE_STORAGE_KEY}` and `noSsr` to `ThemeProvider`. The toggle is then
  only `useColorScheme()` plus an `IconButton`: no store, no effect, no context of our own. `noSsr` is not
  optional here. Without it `useColorScheme()` returns `mode: undefined` on the first render (MUI's
  server-rendering contract), so the button would mount with the wrong icon and flip it a tick later.
- **`localStorage`, key `mt.mode`.** A client-only display flag that the server never reads has no business in
  a cookie riding on every request, and the app already keeps `mt.language` and `mt.mediaTab` there. Naming the
  key ourselves rather than taking MUI's default `mode` is what lets the login page read it: same origin, same
  storage. The constant lives in `frontend/src/theme/mode.ts`.
- **The login page reads the same key with six lines of inline script.** It gets no bundle and no framework -
  it sets the class `light` or `dark` on `<html>` if the key holds one of those, and otherwise does nothing at
  all, because the CSS already follows the OS. The key is a literal in three places - the SPA constant, the
  pre-paint script in the SPA's `index.html`, and the one in the login page - because a script inlined in an
  HTML file can import nothing, so a test stands in for the import at each copy: the toggle test asserts the value written to
  `mt.mode`, `theme/mode.test.ts` asserts that `index.html` contains `MODE_STORAGE_KEY`, and `AuthRoutesTest`
  asserts the served login HTML contains the whole `localStorage.getItem("mt.mode")` expression.
- **`light-dark()` instead of a duplicated palette.** The obvious way to make the login page overridable is to
  keep the `@media (prefers-color-scheme: dark)` block and add a `:root.dark` block beside it - which writes
  every dark colour twice. Instead each custom property is declared once as
  `--bg: light-dark(#f4f6fa, #121721)`, and the classes only set `color-scheme: light` / `dark`, which is what
  `light-dark()` resolves against. The media query disappears, the two palettes stay adjacent on one line each,
  and with no class the behaviour is byte-for-byte what it was. `light-dark()` has been Baseline since 2024 and
  this app already requires a browser current enough for React 19.
- **A hand-written pre-paint script in `frontend/index.html` too.** With a class selector the correct class is
  only applied once React mounts, so a dark-preferring user would see a light first paint - MUI emits its
  default scheme under `:root, .light`, so no class means light, not unstyled. MUI ships
  `InitColorSchemeScript` for exactly this, but it is a React component meant for server-rendered frameworks and
  would run just as late in a client-only Vite SPA. The SPA's copy differs from the login page's on purpose: it
  falls back to `matchMedia("(prefers-color-scheme: dark)")` and always sets a class, because that is what MUI's
  generated CSS keys off, while the login page's CSS follows the OS on its own and wants no class unless the
  user has chosen. Next to the script sits a two-rule `<style>` repeating the `color-scheme` declarations MUI
  emits for the same two classes, so the first paint gets the native surfaces right as well. It has to be a
  stylesheet rule, not `documentElement.style.colorScheme`: with `cssVariables` enabled MUI deliberately leaves
  `color-scheme` off the `html` element and puts it on `.light` / `.dark` instead (`CssBaseline.js`), and an
  inline style would outrank those rules for the rest of the session - so the palette would flip on every
  toggle while the scrollbars kept the mode the page loaded in.

## Alternatives not taken

- A three-way cycle system → light → dark, or a menu mirroring `LanguageMenu`: rejected above.
- Our own storage module next to `i18n/language.ts`, feeding `ThemeProvider`: the mode is not a prop, it lives
  inside `useColorScheme`, so this would mean running a second source of truth alongside MUI's and keeping the
  two in step.
- A cookie, which would let the backend render the login page in the right mode server-side with no inline
  script: a cookie on every request and a Kotlin template branch, to avoid six lines of JavaScript.
- Leaving the login page on `prefers-color-scheme`: cheapest, but a user who picks the mode the OS did not
  would meet the other one at every login.

## Consequences

- `document.documentElement` now carries a `light` or `dark` class in the app. Frontend tests share one jsdom
  (`isolate: false`), so `test-setup.ts` strips both in its `afterEach`, next to the language and storage reset.
- The palette is now written down in two places that a test cannot compare - `theme.ts` and `login.css` - as it
  already was before this change. The `light-dark()` rewrite at least reduces the login side from two copies to
  one.
- Nothing renders differently for a user who never touches the button.
