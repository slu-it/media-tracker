import { useState } from "react";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { BaseDialog } from "../../components/dialog/BaseDialog";
import { BooksConfigurationTab } from "../books/components/BooksConfigurationTab";
import { GamesConfigurationTab } from "../games/components/GamesConfigurationTab";
import { ApiKeysTab } from "./components/ApiKeysTab";
import { ExportImportTab } from "./components/ExportImportTab";
import { PasswordTab } from "./components/PasswordTab";

interface UserSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called whenever data outside the settings changed (book types, platforms, an import). */
  onDataChanged?: () => void;
}

type SettingsTab = "password" | "apiKeys" | "exportImport" | "booksConfiguration" | "gamesConfiguration";

const TITLE_ID = "user-settings-title";
const PASSWORD_TAB_ID = "settings-tab-password";
const PASSWORD_PANEL_ID = "settings-tabpanel-password";
const API_KEYS_TAB_ID = "settings-tab-apiKeys";
const API_KEYS_PANEL_ID = "settings-tabpanel-apiKeys";
const EXPORT_IMPORT_TAB_ID = "settings-tab-exportImport";
const EXPORT_IMPORT_PANEL_ID = "settings-tabpanel-exportImport";
const BOOKS_CONFIGURATION_TAB_ID = "settings-tab-booksConfiguration";
const BOOKS_CONFIGURATION_PANEL_ID = "settings-tabpanel-booksConfiguration";
const GAMES_CONFIGURATION_TAB_ID = "settings-tab-gamesConfiguration";
const GAMES_CONFIGURATION_PANEL_ID = "settings-tabpanel-gamesConfiguration";

/** Per-user settings. Five tabs: password, API keys, export/import, and the books and games configuration (book
 * types, platforms). Opens on the Password tab. The configuration tabs and an import report changes through
 * `onDataChanged`. */
export function UserSettingsDialog({ open, onClose, onDataChanged }: UserSettingsDialogProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SettingsTab>("password");

  return (
    <BaseDialog open={open} onClose={onClose} maxWidth="sm" titleId={TITLE_ID}>
      <Typography id={TITLE_ID} variant="h6" component="h2" sx={{ mb: 2 }}>
        {t("settings.title")}
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_event, next: SettingsTab) => setTab(next)}
          aria-label={t("settings.tabs.label")}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab
            value="password"
            label={t("settings.tabs.password")}
            id={PASSWORD_TAB_ID}
            aria-controls={PASSWORD_PANEL_ID}
          />
          <Tab
            value="apiKeys"
            label={t("settings.tabs.apiKeys")}
            id={API_KEYS_TAB_ID}
            aria-controls={API_KEYS_PANEL_ID}
          />
          <Tab
            value="exportImport"
            label={t("settings.tabs.exportImport")}
            id={EXPORT_IMPORT_TAB_ID}
            aria-controls={EXPORT_IMPORT_PANEL_ID}
          />
          <Tab
            value="booksConfiguration"
            label={t("settings.tabs.booksConfiguration")}
            id={BOOKS_CONFIGURATION_TAB_ID}
            aria-controls={BOOKS_CONFIGURATION_PANEL_ID}
          />
          <Tab
            value="gamesConfiguration"
            label={t("settings.tabs.gamesConfiguration")}
            id={GAMES_CONFIGURATION_TAB_ID}
            aria-controls={GAMES_CONFIGURATION_PANEL_ID}
          />
        </Tabs>
      </Box>
      <Box
        role="tabpanel"
        id={PASSWORD_PANEL_ID}
        aria-labelledby={PASSWORD_TAB_ID}
        tabIndex={0}
        hidden={tab !== "password"}
      >
        {tab === "password" && <PasswordTab />}
      </Box>
      <Box
        role="tabpanel"
        id={API_KEYS_PANEL_ID}
        aria-labelledby={API_KEYS_TAB_ID}
        tabIndex={0}
        hidden={tab !== "apiKeys"}
      >
        {tab === "apiKeys" && <ApiKeysTab />}
      </Box>
      <Box
        role="tabpanel"
        id={EXPORT_IMPORT_PANEL_ID}
        aria-labelledby={EXPORT_IMPORT_TAB_ID}
        tabIndex={0}
        hidden={tab !== "exportImport"}
      >
        {tab === "exportImport" && <ExportImportTab onDataChanged={onDataChanged} />}
      </Box>
      <Box
        role="tabpanel"
        id={BOOKS_CONFIGURATION_PANEL_ID}
        aria-labelledby={BOOKS_CONFIGURATION_TAB_ID}
        tabIndex={0}
        hidden={tab !== "booksConfiguration"}
      >
        {tab === "booksConfiguration" && <BooksConfigurationTab onChanged={onDataChanged} />}
      </Box>
      <Box
        role="tabpanel"
        id={GAMES_CONFIGURATION_PANEL_ID}
        aria-labelledby={GAMES_CONFIGURATION_TAB_ID}
        tabIndex={0}
        hidden={tab !== "gamesConfiguration"}
      >
        {tab === "gamesConfiguration" && <GamesConfigurationTab onChanged={onDataChanged} />}
      </Box>
    </BaseDialog>
  );
}
