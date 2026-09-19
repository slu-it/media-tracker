import { AppBar, Box, Toolbar, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LanguageMenu } from "./LanguageMenu";
import { LogoutButton } from "./LogoutButton";
import { SettingsButton } from "./SettingsButton";

export function AppHeader() {
  const { t } = useTranslation();
  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
          {t("app.title")}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LanguageMenu />
          <SettingsButton />
          <LogoutButton />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
