import { apiFetch } from "../../../api/client";
import type { AuthorizeUrlResponse, ConnectDropboxRequest, DropboxStatusResponse } from "../../../types/api";

const BASE = "/api/dropbox";

/** Whether Dropbox backup is configured, connected, and since when. */
export function getDropboxStatus(): Promise<DropboxStatusResponse> {
  return apiFetch<DropboxStatusResponse>(BASE);
}

/** The one-time URL that starts Dropbox's in-app, no-redirect authorization flow. */
export function getAuthorizeUrl(): Promise<AuthorizeUrlResponse> {
  return apiFetch<AuthorizeUrlResponse>(`${BASE}/authorize-url`);
}

/** Exchanges the pasted authorization code for a connection; an invalid/rejected code is a 400 `validation_error`. */
export function connectDropbox(code: string): Promise<DropboxStatusResponse> {
  const body: ConnectDropboxRequest = { code };
  return apiFetch<DropboxStatusResponse>(`${BASE}/connection`, { method: "POST", body: JSON.stringify(body) });
}

export function disconnectDropbox(): Promise<void> {
  return apiFetch<void>(`${BASE}/connection`, { method: "DELETE" });
}
