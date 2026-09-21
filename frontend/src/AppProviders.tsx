import { useMemo, type ReactNode } from "react";
import { CssBaseline } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { deDE, enUS } from "@mui/material/locale";
import { useTranslation } from "react-i18next";
import { appTheme } from "./theme/theme";
import { MODE_STORAGE_KEY } from "./theme/mode";

/**
 * Theme + baseline CSS. MUI's own strings (pagination aria-labels) follow the app language. The color scheme
 * starts as "system" (OS preference) and is pinned to an explicit mode by `ThemeModeToggle`, persisted under
 * `MODE_STORAGE_KEY`. `noSsr` is required for a client-only SPA: without it `useColorScheme()` reports
 * `mode: undefined` on the first render (it normally waits for a server-rendered value to hydrate against), which
 * would make the toggle flip its icon right after mount.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const theme = useMemo(() => createTheme(appTheme, i18n.language === "de" ? deDE : enUS), [i18n.language]);
  return (
    <ThemeProvider theme={theme} defaultMode="system" modeStorageKey={MODE_STORAGE_KEY} noSsr>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
