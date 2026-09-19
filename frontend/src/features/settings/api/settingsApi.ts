import { apiFetch } from "../../../api/client";
import type { ApiKeySlot, ApiKeysResponse } from "../../../types/api";

const BASE = "/api/me/api-keys";

export function getApiKeys(): Promise<ApiKeysResponse> {
  return apiFetch<ApiKeysResponse>(BASE);
}

/** Replaces the key in `slot` with a fresh one; the other slot is returned unchanged. */
export function regenerateApiKey(slot: ApiKeySlot): Promise<ApiKeysResponse> {
  return apiFetch<ApiKeysResponse>(`${BASE}/${slot}`, { method: "POST" });
}
