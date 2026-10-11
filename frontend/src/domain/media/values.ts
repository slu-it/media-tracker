import { formatSeriesPosition } from "./seriesLabel";

/*
 * Frontend mirror of the kind-neutral backend value objects (e.g. games/domain/GameValues.kt). Validators return an
 * error CODE (an i18n key under `validation.*`), never a translated string, so this module stays free of React and
 * i18n.
 */

export const TITLE_MAX_LENGTH = 256;
export const COVER_URL_MAX_LENGTH = 2048;
export const RELEASE_YEAR_MIN_DIGITS = 1000;
export const RELEASE_YEAR_MAX_DIGITS = 9999;
/** First year offered by the year selector; the backend only insists on four digits. */
export const RELEASE_YEAR_SELECT_MIN = 1980;
/** Mirrors `SearchTerm.MAX_LENGTH` (backend). */
export const SEARCH_MAX_LENGTH = 200;

export const DESCRIPTION_MAX_LENGTH = 10000;

/** Mirrors `DeveloperName.MAX_LENGTH` (backend); the vocabulary name limit of every kind. */
export const VOCABULARY_NAME_MAX_LENGTH = 128;
/** Minimum trimmed length before a vocabulary chip input requests suggestions; names can be short. */
export const VOCABULARY_SUGGESTION_MIN_LENGTH = 1;

/** Mirrors the label limit of `PlatformLabel` / `BookTypeLabel` (backend): platform and book type labels. */
export const COLORED_LABEL_MAX_LENGTH = 64;

export type ValidationCode =
  "required" | "tooLong" | "invalidUrl" | "invalidYear" | "invalidRating" | "invalidDate" | "invalidColor";

export function currentYear(): number {
  return new Date().getFullYear();
}

/** Years from `now` down to `min` (default 1980), newest first. */
export function releaseYearOptions(min: number = RELEASE_YEAR_SELECT_MIN, now: number = currentYear()): number[] {
  const years: number[] = [];
  for (let year = now; year >= min; year--) years.push(year);
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

/** The description is optional: an empty value is valid; anything else must fit within the max length. */
export function validateDescription(value: string): ValidationCode | null {
  if (value.trim().length > DESCRIPTION_MAX_LENGTH) return "tooLong";
  return null;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `true` for a real calendar date in strict `YYYY-MM-DD` form (rejects e.g. `2021-02-30`, which `Date` rolls over). */
function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The release date is optional: `null` (only the year is known) is valid; mirrors backend `ReleaseDate`. */
export function validateReleaseDate(value: string | null): ValidationCode | null {
  if (value === null) return null;
  if (!isValidIsoDate(value)) return "invalidDate";
  const year = Number(value.slice(0, 4));
  if (year < RELEASE_YEAR_MIN_DIGITS || year > RELEASE_YEAR_MAX_DIGITS) return "invalidDate";
  return null;
}

/** Non-empty, at most `VOCABULARY_NAME_MAX_LENGTH` characters once trimmed; mirrors backend `DeveloperName`. */
export function validateVocabularyName(value: string): ValidationCode | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "required";
  if (trimmed.length > VOCABULARY_NAME_MAX_LENGTH) return "tooLong";
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

const HEX_COLOR_PATTERN = /^[0-9A-F]{6}$/;

/** Trims, strips one leading `#` and uppercases, the form the backend stores (`RRGGBB`). */
export function normalizeHexColor(raw: string): string {
  const trimmed = raw.trim();
  return (trimmed.startsWith("#") ? trimmed.slice(1) : trimmed).toUpperCase();
}

/** Exactly six hex digits once normalised. */
export function validateHexColor(raw: string): ValidationCode | null {
  return HEX_COLOR_PATTERN.test(normalizeHexColor(raw)) ? null : "invalidColor";
}

/** Label of a colored entry (platform, book type): non-empty, at most `COLORED_LABEL_MAX_LENGTH` once trimmed. */
export function validateColoredLabel(raw: string): ValidationCode | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "required";
  if (trimmed.length > COLORED_LABEL_MAX_LENGTH) return "tooLong";
  return null;
}

export type SeriesPositionCode = "invalidPosition";

/**
 * Up to four integer digits and at most two decimals after "." or ","; with a non-negative sign this is 0 to 9999.99.
 * Deliberately stricter than the backend, which normalises e.g. "2.500" or "00001"; the form rejects them.
 */
const SERIES_POSITION_PATTERN = /^\d{1,4}(?:[.,]\d{1,2})?$/;

/** The position of an item within a series is optional: empty is valid; see backend `SeriesPosition`. */
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
