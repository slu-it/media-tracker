import { apiFetch } from "../../../api/client";
import type { ImportResultResponse } from "../../../types/api";

const BASE = "/api/backup";

/** Table name -> array of row objects (DB column names, primitive values); mirrors the backend's export shape. */
export function fetchExport(): Promise<Record<string, unknown[]>> {
  return apiFetch<Record<string, unknown[]>>(`${BASE}/export`);
}

/** Posts the export file's raw JSON text as is; the server parses and validates it. */
export function importBackup(json: string): Promise<ImportResultResponse> {
  return apiFetch<ImportResultResponse>(`${BASE}/import`, { method: "POST", body: json });
}
