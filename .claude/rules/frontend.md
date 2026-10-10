---
paths:
  - "frontend/src/**"
  - "frontend/index.html"
---
# Frontend conventions (React, MUI, i18next)

ADR 0008 for the stack, ADR 0020 for the theme toggle. Feature layout `src/features/<kind>/{api,domain,hooks,components}`
+ `<Kind>View.tsx`; `games` and `books` are the templates. Kind-neutral code is shared (ADR 0034):
`src/components/media/` (UI, incl. `status/`, `filters/`, `fields/`, `cover/`, `groups/`, `coloredVocabulary/`; ADR 0039 for the cover picker and
`SuggestingTitleField`, ADR 0042 for the group views, ADR 0043 for the colour picker and the configuration editor), `src/domain/media/` (validators, codecs, draft
helpers), `src/hooks/`. Shared code never imports from `src/features/**` and builds no i18n key from a kind name:
kind-neutral strings live under `media.*`, kind-specific texts are passed in as props (the group views and the configuration editor take a translated
`labels` object). Features import no other feature, with one exception: `features/settings` composes the settings tabs
that `features/<kind>` owns (`BooksConfigurationTab`, `GamesConfigurationTab`); a kind never imports from settings. Feature details are in
`docs/features/`.

- **MUI 9**: `sx` prop, `slotProps.*`, icons imported by path (`@mui/icons-material/<Name>`; the barrel import
  is an ESLint error). The theme lives in `src/theme/theme.ts`; there is no `index.css`. `theme.ts` caps every
  dropdown at `MENU_MAX_ITEMS` (6) rows (`MuiSelect.defaultProps.MenuProps` for selects,
  `MuiAutocomplete.styleOverrides.listbox` for autocompletes), so feature code sets no menu height itself and
  menu rows stay a uniform height (`FilterSelect`'s options carry no checkbox; selection shows as the
  `Mui-selected` background). Status filters are icon toggles (`StatusFilterBar` over `StatusToggleBar multiple`),
  not selects.
- **i18n**: every UI string goes through `t()` and must exist in both `src/i18n/en.json` and `de.json` (a test
  compares the key sets). Platform and book type labels come from the database (`/api/game-platforms`, `/api/book-types`), not from
  bundles, and the owner can change them in the settings (ADR 0043).
- **Data revision**: a change made in the settings dialog (types, platforms, an import) reaches the open view by
  remounting it: `SettingsButton` bumps `useDataRevision()` on close (or at once for a change that
  resolves after the dialog closed) and `App.tsx` keys the routed `Container` with it.
  View state therefore has to live in the URL (next rule), never only in component state that should survive.
- **react-refresh / react-hooks**: hooks, constants and validators live in non-component files;
  `set-state-in-effect` is an error, so derive resets from state (pair the stored value with the inputs it was
  chosen for) instead of syncing in an effect.
- **Routes and view state** (ADR 0031, `docs/features/url-routes.md`): paths come from `src/routes.ts`, which
  derives them from `MEDIA_KINDS`/`MEDIA_SUB_PAGES`; never write a path literal. A view's state (search,
  filters, sort, page, year) lives in its URL codec in `features/<kind>/domain/` (`gameViewParams.ts`, `bookViewParams.ts`; the group views share `src/domain/media/groupViewParams.ts`), built on the
  field codecs of `src/domain/media/viewParams.ts`), not in
  `useState`. A view that updates part of its query writes through `useViewParams`, which merges writes within
  one commit; a raw functional `setSearchParams` loses one of two same-commit writes. The ranking replaces its
  whole query, so it uses `setSearchParams` directly. The codec drops anything the backend would answer with 400. Push for navigation (tabs, page,
  year). Replace and drop `page` for refinements (search, filters, sort). Automatic corrections replace too
  (`setPage(page, { replace: true })`).
- **Validation**: backend value class rules are mirrored as validators returning i18n codes, wrapped in
  self-validating field components: shared value classes (`common/domain/MediaValues.kt`, `Vocabulary.kt`) in
  `src/domain/media/values.ts` + `src/components/media/fields/`, kind-specific ones in `features/<kind>/domain/` +
  `features/<kind>/components/fields/`.
- **API**: `src/api/client.ts` (`apiFetch`) redirects to `/login?returnTo=<current location>` on 401, resolves `undefined` for 204 and
  throws `ApiError` (with the parsed `ErrorResponse` as `body`) on other non-2xx. `src/types/api.ts` mirrors the
  backend DTOs by hand; change both together. Page sizes come from the feature constant
  (`GAMES_PAGE_SIZE` / `BOOKS_PAGE_SIZE` = 36 in `<kind>/domain/<kind>Values.ts`), never a literal.
- **Dialogs**: build on `components/dialog/BaseDialog`; `ConfirmDialog` builds on MUI `Dialog` directly. A
  dialog with `contentScroll="children"` needs a fixed `height` and a child that scrolls (the games and books dialogs use
  `scrollInfo` on `CoverAndInfoLayout`, height `MEDIA_DIALOG_HEIGHT`); copy both flags when copying a dialog.
- **Covers**: the cover ratio is per kind. `coverHeight()` and `CoverImage` in `src/components/` default to
  `COVER_ASPECT_RATIO` (22:31, games pass a width only); books pass `BOOK_COVER_ASPECT_RATIO` (2:3) to
  `CoverImage`, `MediaCardShell` and `MediaGrid`.
- **Theme mode**: the localStorage key `mt.mode` from `src/theme/mode.ts` is hard-coded again in the pre-paint
  scripts of `frontend/index.html` and `backend/src/main/resources/login/login.html`; a test pins each copy, so
  change all three together (`docs/features/theme-mode.md`).
- **Verification limits**: jsdom evaluates no MUI breakpoint (not even `xs`) and has no layout engine, so
  responsive `sx`, menu heights and the frozen dialog layout are verified by eye, not by a test.
