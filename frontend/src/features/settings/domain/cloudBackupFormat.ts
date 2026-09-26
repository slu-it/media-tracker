import type { Language } from "../../../i18n/language";

/** Formats an ISO-8601 instant as a locale-appropriate date and time, e.g. "26 Sep 2026, 16:03". */
export function formatDateTime(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

interface SizeUnit {
  unit: Intl.NumberFormatOptions["unit"];
  threshold: number;
}

// Decimal (SI) steps, largest first, so the first one at or below `bytes` wins; mirrors what Dropbox itself
// reports (`size` in bytes, no binary/KiB units in its API).
const SIZE_UNITS: SizeUnit[] = [
  { unit: "gigabyte", threshold: 1_000_000_000 },
  { unit: "megabyte", threshold: 1_000_000 },
  { unit: "kilobyte", threshold: 1_000 },
  { unit: "byte", threshold: 1 },
];

/** Formats a byte count as a locale-appropriate size with one decimal, e.g. "1.2 MB". */
export function formatSize(bytes: number, language: Language): string {
  const { unit, threshold } = SIZE_UNITS.find((candidate) => bytes >= candidate.threshold) ?? SIZE_UNITS.at(-1)!;
  const value = bytes / threshold;
  return new Intl.NumberFormat(language, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}
