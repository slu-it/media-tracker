# Theme mode toggle (MT-010)

ADR: [0020](../decisions/0020-theme-mode-toggle.md).

- Two states, light and dark, switched by `components/layout/ThemeModeToggle.tsx` through MUI's
  `useColorScheme`. `theme.ts` uses `colorSchemeSelector: "class"`, and `AppProviders` lets `ThemeProvider`
  persist the mode (`defaultMode="system"`, `noSsr`).
- The localStorage key is `mt.mode`, exported from `src/theme/mode.ts` and hard-coded in two more places: the
  pre-paint script in `frontend/index.html` and the one in `backend/src/main/resources/login/login.html`, whose
  CSS uses `light-dark()` so the login page follows the same choice. A test pins each of the three copies (ADR
  0020 lists them); change all three together.
