import { formatSeriesPosition } from "./seriesLabel";

/*
 * Frontend mirror of the books-specific constants; the kind-neutral validators live in
 * `domain/media/values.ts`.
 */

/** Books per grid page. Sent explicitly on every request, so it is independent of the backend default. */
export const BOOKS_PAGE_SIZE = 36;

/** Width / height of a book cover frame (2:3, the usual paperback proportion). */
export const BOOK_COVER_ASPECT_RATIO = 2 / 3;

/** The trimmed title must reach this length before title suggestions are requested. */
export const BOOK_TITLE_SUGGESTION_MIN_LENGTH = 3;

/** Mirrors the backend's author search limit; the author chip input asks for at most this many matches. */
export const AUTHOR_SEARCH_LIMIT = 10;

/** Mirrors the backend's narrator search limit; the narrator chip input asks for at most this many matches. */
export const NARRATOR_SEARCH_LIMIT = 10;

/** Mirrors the backend's series search limit; the series chip input asks for at most this many matches. */
export const SERIES_SEARCH_LIMIT = 10;

/** Oldest year offered by the book year selector (classics predate games by centuries). */
export const BOOK_RELEASE_YEAR_SELECT_MIN = 1450;

export type SeriesPositionCode = "invalidPosition";

/**
 * Up to four integer digits and at most two decimals after "." or ","; with a non-negative sign this is 0 to 9999.99.
 * Deliberately stricter than the backend, which normalises e.g. "2.500" or "00001"; the form rejects them.
 */
const SERIES_POSITION_PATTERN = /^\d{1,4}(?:[.,]\d{1,2})?$/;

/** The position of a book within a series is optional: empty is valid; see backend `BookSeriesPosition`. */
export function validateSeriesPosition(raw: string): SeriesPositionCode | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return SERIES_POSITION_PATTERN.test(trimmed) ? null : "invalidPosition";
}

/** The number for a valid position input, `null` for an empty or invalid one. */
export function parseSeriesPosition(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || validateSeriesPosition(trimmed) !== null) return null;
  return Number(trimmed.replace(",", "."));
}

/** The input text for a stored position, with the active language's decimal separator (2.5 is "2,5" in German). */
export function formatSeriesPositionInput(position: number | null, language: string): string {
  return position === null ? "" : formatSeriesPosition(position, language);
}
