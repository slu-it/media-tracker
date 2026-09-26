import { apiFetch } from "../../../api/client";
import type {
  CoverOptionsResponse,
  CoverType,
  CreateGameDeveloperRequest,
  CreateGameRequest,
  GameDeveloperResponse,
  GameMetaResponse,
  GamePlatformResponse,
  GameResponse,
  PageResponse,
  TitleSuggestionsResponse,
  UpdateGameRequest,
} from "../../../types/api";
import { isExistingDeveloper, type DeveloperDraft } from "../domain/developerDraft";
import type { GameFilters } from "../domain/gameFilters";
import { DEVELOPER_SEARCH_LIMIT } from "../domain/gameValues";

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

/** Title-only, SteamGridDB-backed suggestions for the add/edit form; `query` is required by the backend. */
export function getTitleSuggestions(query: string): Promise<TitleSuggestionsResponse> {
  const params = new URLSearchParams({ query: query.trim() });
  return apiFetch<TitleSuggestionsResponse>(`${BASE}/title-suggestions?${params}`);
}

/**
 * Game-independent: matches for the developer chip input, capped at `DEVELOPER_SEARCH_LIMIT`. `signal` lets a
 * caller abort a stale request when the search term changes again before this one resolves.
 */
export function searchGameDevelopers(search: string, signal?: AbortSignal): Promise<GameDeveloperResponse[]> {
  const params = new URLSearchParams({ search: search.trim(), limit: String(DEVELOPER_SEARCH_LIMIT) });
  return apiFetch<GameDeveloperResponse[]>(`/api/game-developers?${params}`, { signal });
}

/** Adds `name` to the developer vocabulary; the backend returns the existing developer (200) if it already exists. */
export function createGameDeveloper(name: string): Promise<GameDeveloperResponse> {
  const body: CreateGameDeveloperRequest = { name };
  return apiFetch<GameDeveloperResponse>("/api/game-developers", { method: "POST", body: JSON.stringify(body) });
}

/**
 * Resolves a `GameForm` draft's developers to ids right before saving: an existing developer keeps its id; a
 * pending one (free-solo text typed by the user) is created via `createGameDeveloper` - sequentially, one name at
 * a time, so two identical pending names never race each other into two backend rows - then cached by its
 * (trimmed, case-insensitive) name so a repeat of it in the same list is not created twice. The result is
 * deduped: a pending name can resolve to a developer already selected elsewhere in the list.
 */
export async function resolveDeveloperIds(drafts: DeveloperDraft[]): Promise<string[]> {
  const idsByPendingName = new Map<string, string>();
  const ids: string[] = [];
  for (const draft of drafts) {
    if (isExistingDeveloper(draft)) {
      ids.push(draft.id);
      continue;
    }
    const key = draft.name.trim().toLowerCase();
    const cachedId = idsByPendingName.get(key);
    if (cachedId !== undefined) {
      ids.push(cachedId);
      continue;
    }
    const created = await createGameDeveloper(draft.name);
    idsByPendingName.set(key, created.id);
    ids.push(created.id);
  }
  return [...new Set(ids)];
}
