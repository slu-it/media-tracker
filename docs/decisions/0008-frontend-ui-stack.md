# 0008: MUI (Material Design) with Emotion, i18next for translations

Status: accepted, 2026-09

## Context

Phase 1 had a single React component with hand-written CSS. MT-001 adds an application shell (header, language
switch, media-kind tabs), dialogs with focus management, menus, selects, pagination and forms. Building and
styling those primitives by hand is a poor use of a one-person project's time, and the UI must be usable in
English and German from the start.

## Decision

- **`@mui/material` 9.x with `@emotion/react`/`@emotion/styled`** (Material Design). `@mui/icons-material` for icons,
  imported by path (`@mui/icons-material/Edit`; the bare barrel is banned by an ESLint rule because it drags ~2000
  modules through Vite's dev pre-bundler). Layout and one-off styling use the `sx` prop; `index.css` is gone,
  `CssBaseline` and the theme replace it.
- **One theme (`src/theme/theme.ts`)** with `cssVariables` and `colorSchemes: { light, dark }` selected by the OS
  preference (`colorSchemeSelector: "media"`, no in-app toggle). The palette copies the login page's tokens so both
  surfaces match; the font stack is the system one (no Roboto download, the app is self-hosted and loads nothing from
  a CDN). `AppProviders` merges MUI's `deDE`/`enUS` locale so MUI's own strings follow the app language.
- **`i18next` 26 + `react-i18next` 17** with inline JSON bundles (`src/i18n/en.json`, `de.json`), synchronous
  initialisation (`initAsync: false`), no language detector: the choice is stored under `localStorage["mt.language"]`
  and defaults to English. Keys are typed (`i18next.d.ts` declares `CustomTypeOptions` from the English bundle), so a
  misspelled key fails `tsc`; the German bundle is checked with `satisfies typeof en` and a test compares the key sets.
  Proper nouns (platform labels) stay in code.
- **Common components** live in `src/components/`: `dialog/BaseDialog` (rectangle with a protruding round close
  button and an optional left action column with a top and a bottom slot; an optional fixed height keeps the
  dialog the same size across modes and lets the content scroll), `dialog/ConfirmDialog` (question in, boolean out),
  `dialog/DialogActionButton`, `CoverImage`, `ComingSoon`, and the shell under `layout/`.
- **Feature structure** mirrors the backend: `src/features/<kind>/{api,domain,hooks,components}` plus a
  `<Kind>View.tsx` entry. Domain constraints are mirrored as pure validators (`features/games/domain/gameValues.ts`)
  that return i18n error codes, and wrapped in self-validating field components (`GameTitleField`, ...). Forms only
  compose fields; parents derive validity with `isDraftValid`.
- **No router, no data library.** Tabs are app state persisted in `localStorage["mt.mediaTab"]`; one small hook per
  list (`useGamesPage`) on top of `apiFetch`, which now resolves `undefined` for 204 and carries the parsed
  `ErrorResponse` on `ApiError.body`.
- **Tests**: Vitest + Testing Library + `@testing-library/user-event`, MUI rendered for real in jsdom
  (`test/renderWithProviders.tsx`), `fetch` replaced by a small router (`test/mockFetch.ts`). Dialogs render in
  portals, so tests query through `screen`; MUI selects are opened with `user.click` on the combobox.

## Alternatives not taken

- Material Web Components (`@material/web`): in maintenance mode, no React wrappers, weak typing.
- Joy UI: no longer developed by MUI.
- Tailwind (+ a headless kit): more per-component CSS and a second toolchain for little gain at this size.
- Mantine / Chakra: fine libraries, but the ask was Material Design.
- react-intl / Lingui: ICU messages or an extraction step; i18next's inline typed bundles are enough here.
- TanStack Query: one paginated list does not need a cache layer yet.

## Consequences

- Exact pins as everywhere: `@mui/*` 9.x, `@emotion/*` 11.x, `i18next` 26.x, `react-i18next` 17.x.
- Every visible string goes through `t()` and exists in both bundles.
- MUI 9 API: `slotProps.paper` / `slotProps.htmlInput` instead of the legacy `PaperProps` / `inputProps`;
  system props such as `alignItems` on `Stack` moved into `sx`.
- Hooks, constants and validators live in non-component files (the react-refresh lint rule only allows component
  exports from component files).
- The production bundle grew to ~600 kB minified (~190 kB gzip) because MUI is included; acceptable for a
  logged-in single-page app on a LAN, revisit with code splitting if more features push it further.
