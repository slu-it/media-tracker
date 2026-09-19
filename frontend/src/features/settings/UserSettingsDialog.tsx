import { useState } from "react";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { BaseDialog } from "../../components/dialog/BaseDialog";
import { ApiKeysTab } from "./components/ApiKeysTab";

interface UserSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = "apiKeys";

const TITLE_ID = "user-settings-title";
const API_KEYS_TAB_ID = "settings-tab-apiKeys";
const API_KEYS_PANEL_ID = "settings-tabpanel-apiKeys";

/** Per-user settings. One tab today (API keys); more media-kind settings tabs will join it later. */
export function UserSettingsDialog({ open, onClose }: UserSettingsDialogProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SettingsTab>("apiKeys");

  return (
    <BaseDialog open={open} onClose={onClose} maxWidth="sm" titleId={TITLE_ID}>
      <Typography id={TITLE_ID} variant="h6" component="h2" sx={{ mb: 2 }}>
        {t("settings.title")}
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={tab} onChange={(_event, next: SettingsTab) => setTab(next)} aria-label={t("settings.tabs.label")}>
          <Tab
            value="apiKeys"
            label={t("settings.tabs.apiKeys")}
            id={API_KEYS_TAB_ID}
            aria-controls={API_KEYS_PANEL_ID}
          />
        </Tabs>
      </Box>
      <Box role="tabpanel" id={API_KEYS_PANEL_ID} aria-labelledby={API_KEYS_TAB_ID} tabIndex={0}>
        {tab === "apiKeys" && <ApiKeysTab />}
      </Box>
    </BaseDialog>
  );
}
