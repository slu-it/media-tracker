import { apiFetch } from "../../../api/client";
import type {
  CoverOptionsResponse,
  CoverType,
  CreateGameDeveloperRequest,
  CreateGameRequest,
  GameDeveloperResponse,
  GameDeveloperSummaryResponse,
  GameMetaResponse,
  GamePlatformResponse,
  GamePlatformSummaryResponse,
  CreateColoredEntryRequest,
  UpdateColoredEntryRequest,
  GameResponse,
  GameSort,
  MergeVocabularyRequest,
  PageResponse,
  RenameVocabularyRequest,
  TitleSuggestionsResponse,
  UpdateGameRequest,
} from "../../../types/api";
import type { ColoredEntry } from "../../../components/media/coloredVocabulary/coloredVocabulary";
import { resolveVocabularyIds } from "../../../domain/media/vocabularyDraft";
import type { DeveloperDraft } from "../domain/gameDraft";
import type { GameFilters } from "../domain/gameFilters";
import { ALL_GAMES_PAGE_SIZE, DEVELOPER_SEARCH_LIMIT } from "../domain/gameValues";

const BASE = "/api/games";

export function listGames(
  page: number,
  pageSize: number,
  search: string,
  filters: GameFilters,
  sort?: GameSort,
  rated?: boolean,
): Promise<PageResponse<GameResponse>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const term = search.trim();
  if (term.length > 0) query.set("search", term);
  for (const id of filters.platformIds) query.append("platformIds", id);
  for (const value of filters.ownership) query.append("ownership", value);
  for (const value of filters.progress) query.append("progress", value);
  for (const year of filters.releaseYears) query.append("releaseYear", String(year));
  // "title" is the backend default: omitting it keeps existing request URLs (and their tests) unchanged.
  if (sort !== undefined && sort !== "title") query.set("sort", sort);
  if (rated === true) query.set("rated", "true");
  return apiFetch<PageResponse<GameResponse>>(`${BASE}?${query}`);
}

export interface ListAllGamesOptions {
  /** Checked between page requests; once it reports `true` the loop stops issuing further requests. */
  isCancelled?: () => boolean;
}

/**
 * Fetches every game matching `search`/`filters`/`sort`/`rated` at once, paging through the backend at
 * {@link ALL_GAMES_PAGE_SIZE} per request (sequentially, so an early failure stops further requests) and
 * concatenating the pages' items, deduped by `id` (keeping the first occurrence) in case a page shifts between
 * requests. For a full result set at once (e.g. an export), not the paginated grid. `options.isCancelled` lets a
 * caller (e.g. `useAllGames`, once its effect is superseded) stop the loop early instead of firing requests whose
 * result would only be discarded.
 */
export async function listAllGames(
  search: string,
  filters: GameFilters,
  sort?: GameSort,
  rated?: boolean,
  options?: ListAllGamesOptions,
): Promise<GameResponse[]> {
  const first = await listGames(1, ALL_GAMES_PAGE_SIZE, search, filters, sort, rated);
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages && !options?.isCancelled?.(); page++) {
    const next = await listGames(page, ALL_GAMES_PAGE_SIZE, search, filters, sort, rated);
    items.push(...next.items);
  }
  return dedupeById(items);
}

function dedupeById(items: GameResponse[]): GameResponse[] {
  const seen = new Set<string>();
  const deduped: GameResponse[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  return deduped;
}

export function listGamePlatforms(): Promise<GamePlatformResponse[]> {
  return apiFetch<GamePlatformResponse[]>("/api/game-platforms");
}

/** Platforms with their game counts for the configuration tab, sorted by label. */
export async function listGamePlatformSummaries(): Promise<ColoredEntry[]> {
  const summaries = await apiFetch<GamePlatformSummaryResponse[]>("/api/game-platforms.summaries");
  return summaries.map(({ gameCount, ...platform }) => ({ ...platform, count: gameCount }));
}

/** 201; 409 `name_taken` when the label exists. */
export function createGamePlatform(label: string, associatedColor: string): Promise<GamePlatformResponse> {
  const body: CreateColoredEntryRequest = { label, associatedColor };
  return apiFetch<GamePlatformResponse>("/api/game-platforms", { method: "POST", body: JSON.stringify(body) });
}

/** 404 for an unknown id, 409 `name_taken` for a label that exists. */
export function updateGamePlatform(id: string, body: UpdateColoredEntryRequest): Promise<GamePlatformResponse> {
  return apiFetch<GamePlatformResponse>(`/api/game-platforms/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** 204; 409 while games still use the platform, 404 for an unknown id. */
export function deleteGamePlatform(id: string): Promise<void> {
  return apiFetch<void>(`/api/game-platforms/${encodeURIComponent(id)}`, { method: "DELETE" });
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

/** Every developer with their game count (including 0), by name; unpaged. */
export function listGameDeveloperSummaries(): Promise<GameDeveloperSummaryResponse[]> {
  return apiFetch<GameDeveloperSummaryResponse[]>("/api/game-developers.summaries");
}

/** The games of one developer; 404 for an unknown developer. */
export function listDeveloperGames(developerId: string, signal?: AbortSignal): Promise<GameResponse[]> {
  return apiFetch<GameResponse[]>(`/api/game-developers/${encodeURIComponent(developerId)}/games`, { signal });
}

/** Renames the developer; 409 `name_taken` (with `existingId`/`existingName`) when another developer has the name. */
export function renameGameDeveloper(id: string, name: string): Promise<GameDeveloperResponse> {
  const body: RenameVocabularyRequest = { name };
  return apiFetch<GameDeveloperResponse>(`/api/game-developers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Moves every game of the developer to `targetId` and deletes the developer; resolves the target. */
export function mergeGameDeveloper(id: string, targetId: string): Promise<GameDeveloperResponse> {
  const body: MergeVocabularyRequest = { targetId };
  return apiFetch<GameDeveloperResponse>(`/api/game-developers/${encodeURIComponent(id)}/merge`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** 204; 409 while games still use the developer, 404 for an unknown id. */
export function deleteGameDeveloper(id: string): Promise<void> {
  return apiFetch<void>(`/api/game-developers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Resolves a `GameForm` draft's developers to ids right before saving (see `resolveVocabularyIds`). */
export function resolveDeveloperIds(drafts: DeveloperDraft[]): Promise<string[]> {
  return resolveVocabularyIds(drafts, createGameDeveloper);
}
