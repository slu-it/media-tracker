import { useRef, type ChangeEvent, type CSSProperties } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useExportImport } from "../hooks/useExportImport";

// Visually hidden but still in the accessibility tree and clickable, so the file input stays reachable via its
// label while only the button in front of it is seen.
const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/** Export/import of the full JSON backup: a download button and a file-picker import, each with its own status. */
export function ExportImportTab() {
  const { t } = useTranslation();
  const { exporting, exportError, runExport, importing, importError, importResult, runImport } = useExportImport(
    t("settings.exportImport.exportFailed"),
    t("settings.exportImport.importFailed"),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allows re-selecting the same file
    if (file) void runImport(file);
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="subtitle1">{t("settings.exportImport.exportTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("settings.exportImport.exportHint")}
        </Typography>
        {exportError && <Alert severity="error">{exportError}</Alert>}
        <Box>
          <Button variant="outlined" onClick={() => void runExport()} disabled={exporting}>
            {t("settings.exportImport.exportButton")}
          </Button>
        </Box>
      </Stack>
      <Stack spacing={1}>
        <Typography variant="subtitle1">{t("settings.exportImport.importTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("settings.exportImport.importHint")}
        </Typography>
        {importError && <Alert severity="error">{importError}</Alert>}
        {importResult && (
          <Alert severity="success">
            <Stack spacing={0.5}>
              {Object.entries(importResult.tables).map(([table, result]) => (
                <Typography key={table} variant="body2">
                  {t("settings.exportImport.tableResult", {
                    table,
                    inserted: result.inserted,
                    skipped: result.skipped,
                  })}
                </Typography>
              ))}
            </Stack>
          </Alert>
        )}
        <Box>
          <Button variant="outlined" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {t("settings.exportImport.importButton")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            aria-label={t("settings.exportImport.fileInputLabel")}
            style={VISUALLY_HIDDEN}
            onChange={handleFileChange}
          />
        </Box>
      </Stack>
    </Stack>
  );
}
