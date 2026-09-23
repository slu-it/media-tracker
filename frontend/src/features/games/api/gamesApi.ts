import { apiFetch } from "../../../api/client";
import type {
  CoverOptionsResponse,
  CoverType,
  CreateGameRequest,
  GameMetaResponse,
  GamePlatformResponse,
  GameResponse,
  PageResponse,
  UpdateGameRequest,
} from "../../../types/api";
import type { GameFilters } from "../domain/gameFilters";

const BASE = "/api/games";

export function listGames(
  page: number,
  pageSize: number,
  search: string,
  filters: GameFilters,
): Promise<PageResponse<GameResponse>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const term = search.trim();
  if (term.length > 0) query.set("search", term);
  for (const id of filters.platformIds) query.append("platformIds", id);
  for (const value of filters.ownership) query.append("ownership", value);
  for (const value of filters.progress) query.append("progress", value);
  for (const year of filters.releaseYears) query.append("releaseYear", String(year));
  return apiFetch<PageResponse<GameResponse>>(`${BASE}?${query}`);
}

export function listGamePlatforms(): Promise<GamePlatformResponse[]> {
  return apiFetch<GamePlatformResponse[]>("/api/game-platforms");
}

export function getGamesMeta(): Promise<GameMetaResponse> {
  return apiFetch<GameMetaResponse>("/api/games.meta");
}

export function createGame(body: CreateGameRequest): Promise<GameResponse> {
  return apiFetch<GameResponse>(BASE, { method: "POST", body: JSON.stringify(body) });
}

export function updateGame(id: string, body: UpdateGameRequest): Promise<GameResponse> {
  return apiFetch<GameResponse>(`${BASE}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
}

/** 204 for existing and unknown ids alike. */
export function deleteGame(id: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/**
 * Game-independent: the cover picker is reachable from the add form too, before a game exists. `query` is
 * required by the backend (400 when missing/blank); `releaseYear`, `match`, `type` and `page` are appended only
 * when given, and the backend defaults `type` to `"static"` and `page` to `1`.
 */
export function getCoverOptions(params: {
  query: string;
  releaseYear?: number | null;
  match?: number;
  type?: CoverType;
  page?: number;
}): Promise<CoverOptionsResponse> {
  const query = new URLSearchParams({ query: params.query.trim() });
  if (typeof params.releaseYear === "number") query.set("releaseYear", String(params.releaseYear));
  if (params.match !== undefined) query.set("match", String(params.match));
  if (params.type !== undefined) query.set("type", params.type);
  if (params.page !== undefined) query.set("page", String(params.page));
  return apiFetch<CoverOptionsResponse>(`${BASE}/cover-options?${query}`);
}
