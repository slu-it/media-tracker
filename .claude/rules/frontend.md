---
paths:
  - "frontend/src/**"
  - "frontend/index.html"
---
# Frontend conventions (React, MUI, i18next)

ADR 0008 for the stack, ADR 0020 for the theme toggle. Feature layout `src/features/<kind>/{api,domain,hooks,components}`
+ `<Kind>View.tsx`; `games` is the template. Feature details are in `docs/features/`.

- **MUI 9**: `sx` prop, `slotProps.*`, icons imported by path (`@mui/icons-material/<Name>`; the barrel import
  is an ESLint error). The theme lives in `src/theme/theme.ts`; there is no `index.css`. `theme.ts` caps every
  dropdown at `MENU_MAX_ITEMS` (6) rows (`MuiSelect.defaultProps.MenuProps` for selects,
  `MuiAutocomplete.styleOverrides.listbox` for autocompletes), so feature code sets no menu height itself and
  menu rows stay a uniform height (hence the compact `Checkbox` in `GameFilterBar`).
- **i18n**: every UI string goes through `t()` and must exist in both `src/i18n/en.json` and `de.json` (a test
  compares the key sets). Platform labels come from the database via `/api/game-platforms`, not from bundles.
- **react-refresh / react-hooks**: hooks, constants and validators live in non-component files;
  `set-state-in-effect` is an error, so derive resets from state (pair the stored value with the inputs it was
  chosen for) instead of syncing in an effect.
- **Validation**: backend value class rules are mirrored as validators in `features/<kind>/domain/` returning
  i18n codes, wrapped in self-validating field components under `features/<kind>/components/fields/`.
- **API**: `src/api/client.ts` (`apiFetch`) redirects to `/login` on 401, resolves `undefined` for 204 and
  throws `ApiError` (with the parsed `ErrorResponse` as `body`) on other non-2xx. `src/types/api.ts` mirrors the
  backend DTOs by hand; change both together. Page sizes come from the feature constant
  (`GAMES_PAGE_SIZE` = 36 in `games/domain/gameValues.ts`), never a literal.
- **Dialogs**: build on `components/dialog/BaseDialog`; `ConfirmDialog` builds on MUI `Dialog` directly. A
  dialog with `contentScroll="children"` needs a fixed `height` and a child that scrolls (the games dialogs use
  `scrollInfo` on `CoverAndInfoLayout`); copy both flags when copying the games dialogs.
- **Covers**: every cover frame is 22:31 via `COVER_ASPECT_RATIO`/`coverHeight()` in `src/components/coverFrame.ts`;
  call sites pass a width only.
- **Theme mode**: the localStorage key `mt.mode` from `src/theme/mode.ts` is hard-coded again in the pre-paint
  scripts of `frontend/index.html` and `backend/src/main/resources/login/login.html`; a test pins each copy, so
  change all three together (`docs/features/theme-mode.md`).
- **Verification limits**: jsdom evaluates no MUI breakpoint (not even `xs`) and has no layout engine, so
  responsive `sx`, menu heights and the frozen dialog layout are verified by eye, not by a test.
