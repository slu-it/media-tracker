import { apiFetch } from "../../../api/client";
import type { CloudBackupResponse, ImportResultResponse } from "../../../types/api";

const BASE = "/api/backup";

/** Table name -> array of row objects (DB column names, primitive values); mirrors the backend's export shape. */
export function fetchExport(): Promise<Record<string, unknown[]>> {
  return apiFetch<Record<string, unknown[]>>(`${BASE}/export`);
}

/** Posts the export file's raw JSON text as is; the server parses and validates it. */
export function importBackup(json: string): Promise<ImportResultResponse> {
  return apiFetch<ImportResultResponse>(`${BASE}/import`, { method: "POST", body: json });
}

/** The latest Dropbox cloud backup, or `null` when none has been uploaded yet. Not connected is a 503. */
export function getCloudBackup(): Promise<CloudBackupResponse> {
  return apiFetch<CloudBackupResponse>(`${BASE}/dropbox`);
}

/** Runs the same export and uploads it to Dropbox now. Not connected is a 503, a Dropbox failure a 502. */
export function backupToDropboxNow(): Promise<CloudBackupResponse> {
  return apiFetch<CloudBackupResponse>(`${BASE}/dropbox`, { method: "POST" });
}
