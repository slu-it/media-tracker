// Hand-written mirrors of the Kotlin DTOs in backend/src/main/kotlin/de/sluit/mediatracker/common/api/Dtos.kt,
// .../auth/api/AuthDtos.kt (MeResponse, ApiKeysResponse) and .../games/api/GameDtos.kt. Keep them in sync.

/** Mirrors the Kotlin `Ownership` enum in games/domain/GameStatus.kt. */
export type Ownership = "watchlist" | "owned";

/** Mirrors the Kotlin `Progress` enum in games/domain/GameStatus.kt. */
export type Progress = "not_started" | "playing" | "finished" | "completed" | "paused" | "abandoned";

export interface MeResponse {
  username: string;
}

/** The user's two MCP API keys; `null` means the slot has no key yet. */
export interface ApiKeysResponse {
  primary: string | null;
  secondary: string | null;
}

export type ApiKeySlot = "primary" | "secondary";

/** Body of every non-2xx API response. `message` is only present when the backend has a detail to add. */
export interface ErrorResponse {
  error: string;
  message?: string;
}

/** One page of a list. `page` is 1-based; `totalPages` is 0 when there are no items. */
export interface PageResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** A selectable platform; `associatedColor` is `"RRGGBB"` without a leading `#`. */
export interface GamePlatformResponse {
  id: string;
  label: string;
  associatedColor: string;
}

/** The filter values that actually occur in the stored games; mirrors `GameMetaResponse` in games/api/GameDtos.kt. */
export interface GameMetaResponse {
  /** Only platforms in use, alphabetically by label. */
  platforms: GamePlatformResponse[];
  /** Only values in use, in enum declaration order. */
  ownership: Ownership[];
  /** Only values in use, in enum declaration order. */
  progress: Progress[];
  /** Only years in use, ascending. */
  releaseYears: number[];
}

export interface GameResponse {
  id: string;
  title: string;
  releaseYear: number;
  /** At least one, sorted by label. */
  platforms: GamePlatformResponse[];
  /** Free text, at most 10000 characters; `null` when not set. */
  description: string | null;
  /** 0.25..5 in steps of 0.25; `null` means not rated yet. */
  rating: number | null;
  coverImageUrl: string | null;
  ownership: Ownership;
  progress: Progress;
  hidden: boolean;
}

export interface CreateGameRequest {
  title: string;
  releaseYear: number;
  platformIds: string[];
  description?: string | null;
  rating?: number | null;
  coverImageUrl?: string | null;
  /** Omit for the default (`"watchlist"`); can never be cleared. */
  ownership?: Ownership | null;
  /** Omit for the default (`"not_started"`); can never be cleared. */
  progress?: Progress | null;
  /** Omit for the default (`false`); can never be cleared. */
  hidden?: boolean | null;
}

/** PATCH body: omit a key to leave the field unchanged; `null` clears `description`/`rating`/`coverImageUrl`. */
export interface UpdateGameRequest {
  title?: string;
  releaseYear?: number;
  platformIds?: string[];
  description?: string | null;
  rating?: number | null;
  coverImageUrl?: string | null;
  /** Omit to leave unchanged; can never be cleared, so there is no `null` variant. */
  ownership?: Ownership;
  /** Omit to leave unchanged; can never be cleared, so there is no `null` variant. */
  progress?: Progress;
  /** Omit to leave unchanged; can never be cleared, so there is no `null` variant. */
  hidden?: boolean;
}
