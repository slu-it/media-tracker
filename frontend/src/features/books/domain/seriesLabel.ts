import type { TFunction } from "i18next";
import type { BookSeriesEntryResponse } from "../../../types/api";

/** A position in the language's decimal format, never grouped (1000 is "1000", not "1.000" in German). */
export function formatSeriesPosition(position: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2, useGrouping: false }).format(position);
}

/** "Mistborn #1" (the number in the active language's format, 2.5 is "2,5" in German) or just the name. */
export function formatSeriesEntry(entry: BookSeriesEntryResponse, t: TFunction, language: string): string {
  if (entry.position === null) return entry.name;
  const position = formatSeriesPosition(entry.position, language);
  return t("books.fields.seriesEntry", { name: entry.name, position });
}
