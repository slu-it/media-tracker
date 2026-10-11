import type { TFunction } from "i18next";

/** A series a media item belongs to, with its optional number there (the books' and games' series entries). */
export interface SeriesEntry {
  id: string;
  name: string;
  position: number | null;
}

/** A position in the language's decimal format, never grouped (1000 is "1000", not "1.000" in German). */
export function formatSeriesPosition(position: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2, useGrouping: false }).format(position);
}

/** "Mistborn #1" (the number in the active language's format, 2.5 is "2,5" in German) or just the name. */
export function formatSeriesEntry(entry: SeriesEntry, t: TFunction, language: string): string {
  if (entry.position === null) return entry.name;
  const position = formatSeriesPosition(entry.position, language);
  return t("media.series.entry", { name: entry.name, position });
}

/**
 * The card's heuristic for the item's "main" series: the lowest position wins, an entry without a position ranks
 * after every number, ties go to the name (locale compare), then to the id. Does not mutate the input.
 */
export function primarySeries<E extends SeriesEntry>(series: E[]): E | undefined {
  return series.reduce<E | undefined>(
    (best, entry) => (best === undefined || compareSeriesEntries(entry, best) < 0 ? entry : best),
    undefined,
  );
}

function compareSeriesEntries(a: SeriesEntry, b: SeriesEntry): number {
  if (a.position !== b.position) {
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  }
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}
