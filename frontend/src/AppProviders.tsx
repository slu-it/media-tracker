import { useMemo, type ReactNode } from "react";
import { CssBaseline } from "@mui/material";
import { ThemeProvider, createTheme, type ThemeOptions } from "@mui/material/styles";
import { deDE, enUS } from "@mui/material/locale";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { deDE as datePickersDeDE, enUS as datePickersEnUS } from "@mui/x-date-pickers/locales";
import "dayjs/locale/de";
import { useTranslation } from "react-i18next";
import { appTheme } from "./theme/theme";
import { MODE_STORAGE_KEY } from "./theme/mode";

/**
 * Theme + baseline CSS. MUI's own strings (pagination aria-labels, date picker toolbar/labels) follow the app
 * language, and the date picker's calendar (month/weekday names, week start) follows `adapterLocale`. The color
 * scheme starts as "system" (OS preference) and is pinned to an explicit mode by `ThemeModeToggle`, persisted
 * under `MODE_STORAGE_KEY`. `noSsr` is required for a client-only SPA: without it `useColorScheme()` reports
 * `mode: undefined` on the first render (it normally waits for a server-rendered value to hydrate against), which
 * would make the toggle flip its icon right after mount. `themeOverrides` is merged last into the theme; only
 * tests pass it (see `renderWithProviders`).
 */
export function AppProviders({ children, themeOverrides }: { children: ReactNode; themeOverrides?: ThemeOptions }) {
  const { i18n } = useTranslation();
  const isGerman = i18n.language === "de";
  const theme = useMemo(
    () => createTheme(appTheme, isGerman ? deDE : enUS, themeOverrides ?? {}),
    [isGerman, themeOverrides],
  );
  const localeText = (isGerman ? datePickersDeDE : datePickersEnUS).components.MuiLocalizationProvider.defaultProps
    .localeText;
  return (
    <ThemeProvider theme={theme} defaultMode="system" modeStorageKey={MODE_STORAGE_KEY} noSsr>
      <CssBaseline enableColorScheme />
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={isGerman ? "de" : "en"} localeText={localeText}>
        {children}
      </LocalizationProvider>
    </ThemeProvider>
  );
}
