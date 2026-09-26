import dayjs from "dayjs";

const FALLBACK_FORMAT = "YYYY-MM-DD";

/** dayjs format tokens for the numeric parts `Intl.DateTimeFormat` can report. */
const PART_TOKENS: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {
  day: "DD",
  month: "MM",
  year: "YYYY",
};

/**
 * Builds a dayjs date format (e.g. `"DD.MM.YYYY"` for `de-DE`, `"MM/DD/YYYY"` for `en-US`) from the locale's
 * numeric day/month/year order and separators. Falls back to ISO order when `Intl` is unavailable, the locale
 * is invalid or formatting otherwise throws.
 */
export function browserDateFormat(locale: string = navigator.language): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).formatToParts(new Date(2000, 0, 1));
    return parts.map((part) => PART_TOKENS[part.type] ?? `[${part.value}]`).join("");
  } catch {
    return FALLBACK_FORMAT;
  }
}

/** Formats an ISO-8601 `YYYY-MM-DD` release date for display, in the given locale's date format. */
export function formatReleaseDate(iso: string, locale: string = navigator.language): string {
  return dayjs(iso).format(browserDateFormat(locale));
}
