/*
 * Frontend mirror of the games-specific backend value objects (games/domain/GameValues.kt); the kind-neutral
 * validators live in `domain/media/values.ts`.
 */

import type { ValidationCode } from "../../../domain/media/values";

/** Games per grid page. Sent explicitly on every request, so it is independent of the backend default. */
export const GAMES_PAGE_SIZE = 36;
/** Page size `listAllGames` requests, the backend's maximum; keeps the number of round-trips as low as possible. */
export const ALL_GAMES_PAGE_SIZE = 200;
/** Minimum trimmed title length before the add/edit form requests title suggestions. */
export const TITLE_SUGGESTION_MIN_LENGTH = 5;

export const RATING_MIN = 0.25;
export const RATING_MAX = 5;
export const RATING_STEP = 0.25;

/** Mirrors `VocabularySearchLimit.DEFAULT` (backend); the developer chip input asks for at most this many matches. */
export const DEVELOPER_SEARCH_LIMIT = 10;

export function validatePlatformIds(ids: string[]): ValidationCode | null {
  return ids.length === 0 ? "required" : null;
}

/** `null` (not rated) is valid; otherwise the value must be finite, in range and a multiple of the step. */
export function validateRating(value: number | null): ValidationCode | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return "invalidRating";
  if (value < RATING_MIN || value > RATING_MAX) return "invalidRating";
  if (value * 4 !== Math.round(value * 4)) return "invalidRating";
  return null;
}
