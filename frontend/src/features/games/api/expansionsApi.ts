import { apiFetch } from "../../../api/client";
import type { CreateExpansionRequest, ExpansionResponse, UpdateExpansionRequest } from "../../../types/api";

const BASE = (gameId: string) => `/api/games/${encodeURIComponent(gameId)}/expansions`;

/** Ordered by sequence. */
export function listExpansions(gameId: string): Promise<ExpansionResponse[]> {
  return apiFetch<ExpansionResponse[]>(BASE(gameId));
}

export function createExpansion(gameId: string, body: CreateExpansionRequest): Promise<ExpansionResponse> {
  return apiFetch<ExpansionResponse>(BASE(gameId), { method: "POST", body: JSON.stringify(body) });
}

export function updateExpansion(
  gameId: string,
  expansionId: string,
  body: UpdateExpansionRequest,
): Promise<ExpansionResponse> {
  return apiFetch<ExpansionResponse>(`${BASE(gameId)}/${encodeURIComponent(expansionId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteExpansion(gameId: string, expansionId: string): Promise<void> {
  return apiFetch<void>(`${BASE(gameId)}/${encodeURIComponent(expansionId)}`, { method: "DELETE" });
}
