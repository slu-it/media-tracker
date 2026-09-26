import { useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../../../api/client";
import { ConfirmDialog } from "../../../components/dialog/ConfirmDialog";
import type { Language } from "../../../i18n/language";
import { formatDateTime, formatSize } from "../domain/cloudBackupFormat";
import { validateAuthorizationCode } from "../domain/dropboxValues";
import { isDropboxError, useCloudBackup } from "../hooks/useCloudBackup";
import { useDropbox } from "../hooks/useDropbox";
import { AuthorizationCodeField } from "./fields/AuthorizationCodeField";

/** Dropbox connection and the daily cloud backup (MT-024): third section of the export/import tab. */
export function DropboxBackupSection() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const [code, setCode] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const {
    status,
    loading,
    error,
    reload,
    authorizeUrl,
    openError,
    connecting,
    connectError,
    connect,
    disconnecting,
    disconnectError,
    disconnect,
  } = useDropbox();

  const {
    lastBackup,
    loading: backupLoading,
    error: backupLoadError,
    backingUp,
    backupError,
    unavailable: backupUnavailable,
    backupNow,
  } = useCloudBackup(
    status?.available === true && status.connected,
    // A 503 dropbox_unavailable means the backend deleted the connection (revoked in Dropbox): re-fetch the
    // status so the view falls back to "not connected" instead of showing stale connected controls.
    reload,
  );

  const codeValid = validateAuthorizationCode(code) === null;

  const handleConnect = async () => {
    if (await connect(code)) setCode("");
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1">{t("settings.exportImport.dropbox.title")}</Typography>
      {error !== null && (
        <Alert severity="error">{errorMessage(error, t("settings.exportImport.dropbox.loadFailed"))}</Alert>
      )}
      {loading && <Typography variant="body2">{t("common.loading")}</Typography>}

      {status !== null && !status.available && (
        // role="status" (not the default "alert"): this is a persistent hint, not an error, and must not collide
        // with `findByRole("alert")` queries elsewhere on the page.
        <Alert severity="info" role="status">
          {t("settings.exportImport.dropbox.notAvailableHint")}
        </Alert>
      )}

      {status !== null && status.available && !status.connected && (
        <Stack spacing={1}>
          {openError !== null && (
            <Alert severity="error">
              {errorMessage(openError, t("settings.exportImport.dropbox.openDropboxFailed"))}
            </Alert>
          )}
          {connectError !== null && (
            <Alert severity="error">
              {errorMessage(connectError, t("settings.exportImport.dropbox.connectFailed"))}
            </Alert>
          )}
          {authorizeUrl !== null && (
            <Box>
              {/* A real link (loaded up front, not fetched on click): Safari and strict popup blockers can
                  silently drop a `window.open` that follows an awaited fetch. Hidden until it has loaded. */}
              <Button variant="outlined" component="a" href={authorizeUrl} target="_blank" rel="noopener noreferrer">
                {t("settings.exportImport.dropbox.openDropbox")}
              </Button>
            </Box>
          )}
          <AuthorizationCodeField value={code} onChange={setCode} disabled={connecting} />
          <Box>
            <Button variant="contained" onClick={() => void handleConnect()} disabled={!codeValid || connecting}>
              {t("settings.exportImport.dropbox.connect")}
            </Button>
          </Box>
        </Stack>
      )}

      {status !== null && status.available && status.connected && (
        <Stack spacing={1}>
          {status.connectedAt && (
            <Typography variant="body2">
              {t("settings.exportImport.dropbox.connectedSince", {
                date: formatDateTime(status.connectedAt, language),
              })}
            </Typography>
          )}
          {backupUnavailable && <Alert severity="warning">{t("settings.exportImport.dropbox.connectionLost")}</Alert>}
          {!backupUnavailable && backupLoadError !== null && (
            <Alert severity="error">
              {isDropboxError(backupLoadError)
                ? t("settings.exportImport.dropbox.temporarilyUnavailable")
                : errorMessage(backupLoadError, t("settings.exportImport.dropbox.lastBackupLoadFailed"))}
            </Alert>
          )}
          {!backupUnavailable && backupError !== null && (
            <Alert severity="error">
              {isDropboxError(backupError)
                ? t("settings.exportImport.dropbox.temporarilyUnavailable")
                : errorMessage(backupError, t("settings.exportImport.dropbox.backupNowFailed"))}
            </Alert>
          )}
          {disconnectError !== null && (
            <Alert severity="error">
              {errorMessage(disconnectError, t("settings.exportImport.dropbox.disconnectFailed"))}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            {backupLoading
              ? t("common.loading")
              : lastBackup
                ? t("settings.exportImport.dropbox.lastBackup", {
                    value: `${formatDateTime(lastBackup.modifiedAt, language)} · ${formatSize(lastBackup.sizeBytes, language)}`,
                  })
                : t("settings.exportImport.dropbox.noBackupYet")}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => void backupNow()} disabled={backingUp}>
              {t("settings.exportImport.dropbox.backupNow")}
            </Button>
            <Button color="error" onClick={() => setConfirmOpen(true)} disabled={disconnecting}>
              {t("settings.exportImport.dropbox.disconnect")}
            </Button>
          </Stack>
        </Stack>
      )}

      <ConfirmDialog
        open={confirmOpen}
        question={t("settings.exportImport.dropbox.disconnectQuestion")}
        destructive
        onDecision={(confirmed) => {
          setConfirmOpen(false);
          if (confirmed) void disconnect();
        }}
      />
    </Stack>
  );
}
