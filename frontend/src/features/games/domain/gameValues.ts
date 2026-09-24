/*
 * Frontend mirror of the backend value objects (games/domain/GameValues.kt). Validators return an error CODE
 * (an i18n key under `validation.*`), never a translated string, so this module stays free of React and i18n.
 */

export const TITLE_MAX_LENGTH = 256;
export const COVER_URL_MAX_LENGTH = 2048;
export const RELEASE_YEAR_MIN_DIGITS = 1000;
export const RELEASE_YEAR_MAX_DIGITS = 9999;
/** First year offered by the year selector; the backend only insists on four digits. */
export const RELEASE_YEAR_SELECT_MIN = 1980;
/** Games per grid page. Sent explicitly on every request, so it is independent of the backend default. */
export const GAMES_PAGE_SIZE = 36;
/** How long the search box waits after the last keystroke before firing a request. */
export const SEARCH_DEBOUNCE_MS = 500;
/** Minimum trimmed title length before the add/edit form requests title suggestions. */
export const TITLE_SUGGESTION_MIN_LENGTH = 5;
/** Mirrors `SearchTerm.MAX_LENGTH` (backend). */
export const SEARCH_MAX_LENGTH = 200;

export const DESCRIPTION_MAX_LENGTH = 10000;
export const RATING_MIN = 0.25;
export const RATING_MAX = 5;
export const RATING_STEP = 0.25;

export type ValidationCode = "required" | "tooLong" | "invalidUrl" | "invalidYear" | "invalidRating";

export function currentYear(): number {
  return new Date().getFullYear();
}

/** Years from `now` down to 1980, newest first. */
export function releaseYearOptions(now: number = currentYear()): number[] {
  const years: number[] = [];
  for (let year = now; year >= RELEASE_YEAR_SELECT_MIN; year--) years.push(year);
  return years;
}

export function validateTitle(value: string): ValidationCode | null {
  if (value.trim().length === 0) return "required";
  if (value.trim().length > TITLE_MAX_LENGTH) return "tooLong";
  return null;
}

export function validateReleaseYear(value: number | null): ValidationCode | null {
  if (value === null) return "required";
  if (!Number.isInteger(value) || value < RELEASE_YEAR_MIN_DIGITS || value > RELEASE_YEAR_MAX_DIGITS)
    return "invalidYear";
  return null;
}

export function validatePlatformIds(ids: string[]): ValidationCode | null {
  return ids.length === 0 ? "required" : null;
}

/** The description is optional: an empty value is valid; anything else must fit within the max length. */
export function validateDescription(value: string): ValidationCode | null {
  if (value.trim().length > DESCRIPTION_MAX_LENGTH) return "tooLong";
  return null;
}

/** `null` (not rated) is valid; otherwise the value must be finite, in range and a multiple of the step. */
export function validateRating(value: number | null): ValidationCode | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return "invalidRating";
  if (value < RATING_MIN || value > RATING_MAX) return "invalidRating";
  if (value * 4 !== Math.round(value * 4)) return "invalidRating";
  return null;
}

/** The cover is optional: an empty value is valid; anything else must be an absolute http(s) URL. */
export function validateCoverImageUrl(value: string): ValidationCode | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > COVER_URL_MAX_LENGTH) return "tooLong";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "invalidUrl";
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname.length === 0) return "invalidUrl";
  return null;
}
