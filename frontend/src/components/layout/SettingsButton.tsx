import { useRef, useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { useTranslation } from "react-i18next";
import { useDataRevision } from "../../hooks/dataRevision";
import { UserSettingsDialog } from "../../features/settings/UserSettingsDialog";

/** Icon button that opens the per-user settings dialog; the dialog mounts only while open.
 * Data edited inside it (book types, platforms, imports) bumps the data revision on close so the routed view reloads. */
export function SettingsButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [changed, setChanged] = useState(false);
  const openRef = useRef(false);
  const { bump } = useDataRevision();

  const openDialog = () => {
    openRef.current = true;
    setOpen(true);
  };

  // A change can resolve after the dialog closed (slow import or rename); it then bumps immediately.
  const dataChanged = () => {
    if (openRef.current) setChanged(true);
    else bump();
  };

  const close = () => {
    openRef.current = false;
    setOpen(false);
    if (changed) {
      setChanged(false);
      bump();
    }
  };

  return (
    <>
      <Tooltip title={t("settings.open")}>
        <IconButton color="inherit" aria-label={t("settings.open")} onClick={openDialog}>
          <SettingsIcon />
        </IconButton>
      </Tooltip>
      {open && <UserSettingsDialog open={open} onClose={close} onDataChanged={dataChanged} />}
    </>
  );
}
