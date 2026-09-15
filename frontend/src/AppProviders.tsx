import { useMemo, type ReactNode } from "react";
import { CssBaseline } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { deDE, enUS } from "@mui/material/locale";
import { useTranslation } from "react-i18next";
import { appTheme } from "./theme/theme";

/** Theme + baseline CSS. MUI's own strings (pagination aria-labels) follow the app language. */
export function AppProviders({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const theme = useMemo(() => createTheme(appTheme, i18n.language === "de" ? deDE : enUS), [i18n.language]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
