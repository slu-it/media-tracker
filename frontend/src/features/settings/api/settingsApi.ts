import { apiFetch } from "../../../api/client";
import type { ApiKeySlot, ApiKeysResponse, ChangePasswordRequest } from "../../../types/api";

const BASE = "/api/me/api-keys";

export function getApiKeys(): Promise<ApiKeysResponse> {
  return apiFetch<ApiKeysResponse>(BASE);
}

/** Replaces the key in `slot` with a fresh one; the other slot is returned unchanged. */
export function regenerateApiKey(slot: ApiKeySlot): Promise<ApiKeysResponse> {
  return apiFetch<ApiKeysResponse>(`${BASE}/${slot}`, { method: "POST" });
}

/** Changes the logged-in user's own password; the current session stays logged in, other sessions are logged out
 * server-side. Rejects with `ApiError` (403 `wrong_password`) when `currentPassword` does not match. */
export function changePassword(request: ChangePasswordRequest): Promise<void> {
  return apiFetch<void>("/api/me/password", { method: "PUT", body: JSON.stringify(request) });
}
