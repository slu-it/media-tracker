import { useCallback, useState } from "react";
import { errorMessage } from "../../../api/client";
import type { ImportResultResponse } from "../../../types/api";
import { fetchExport, importBackup } from "../api/backupApi";
import { downloadJson } from "../domain/downloadJson";

export interface ExportImportState {
  exporting: boolean;
  exportError: string | null;
  runExport: () => Promise<void>;
  importing: boolean;
  importError: string | null;
  /** Per-table row counts of the most recent successful import; cleared as soon as a new import starts. */
  importResult: ImportResultResponse | null;
  runImport: (file: File) => Promise<void>;
}

/** Downloads the full export and posts an import file; both actions report their own busy/error state. */
export function useExportImport(exportErrorText: string, importErrorText: string): ExportImportState {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResultResponse | null>(null);

  const runExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      downloadJson(await fetchExport());
    } catch (cause: unknown) {
      setExportError(errorMessage(cause, exportErrorText));
    } finally {
      setExporting(false);
    }
  }, [exportErrorText]);

  const runImport = useCallback(
    async (file: File) => {
      setImporting(true);
      setImportError(null);
      setImportResult(null);
      try {
        setImportResult(await importBackup(await file.text()));
      } catch (cause: unknown) {
        setImportError(errorMessage(cause, importErrorText));
      } finally {
        setImporting(false);
      }
    },
    [importErrorText],
  );

  return { exporting, exportError, runExport, importing, importError, importResult, runImport };
}
