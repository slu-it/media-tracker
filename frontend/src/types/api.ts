// Hand-written mirrors of the Kotlin DTOs in backend/src/main/kotlin/de/sluit/mediatracker/common/api/Dtos.kt,
// .../auth/api/AuthDtos.kt (MeResponse) and .../games/api/GameDtos.kt. Keep them in sync.

export interface MeResponse {
  username: string;
}

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
}

export interface CreateGameRequest {
  title: string;
  releaseYear: number;
  platformIds: string[];
  description?: string | null;
  rating?: number | null;
  coverImageUrl?: string | null;
}

/** PATCH body: omit a key to leave the field unchanged; `null` clears `description`/`rating`/`coverImageUrl`. */
export interface UpdateGameRequest {
  title?: string;
  releaseYear?: number;
  platformIds?: string[];
  description?: string | null;
  rating?: number | null;
  coverImageUrl?: string | null;
}
