import { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { useTranslation } from "react-i18next";
import { UserSettingsDialog } from "../../features/settings/UserSettingsDialog";

/** Icon button that opens the per-user settings dialog; the dialog mounts only while open. */
export function SettingsButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title={t("settings.open")}>
        <IconButton color="inherit" aria-label={t("settings.open")} onClick={() => setOpen(true)}>
          <SettingsIcon />
        </IconButton>
      </Tooltip>
      {open && <UserSettingsDialog open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
