import { apiFetch } from "../../../api/client";
import type {
  CreateGameRequest,
  GamePlatformResponse,
  GameResponse,
  PageResponse,
  UpdateGameRequest,
} from "../../../types/api";

const BASE = "/api/games";

export function listGames(page: number, pageSize: number): Promise<PageResponse<GameResponse>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<PageResponse<GameResponse>>(`${BASE}?${query}`);
}

export function listGamePlatforms(): Promise<GamePlatformResponse[]> {
  return apiFetch<GamePlatformResponse[]>("/api/game-platforms");
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
