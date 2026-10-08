import type { BookSeriesSummaryResponse } from "../../../types/api";

/** Lower-cased and without accents ("Éowyn" becomes "eowyn"), roughly like the backend's `uca1400_ai_ci` collation. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Series whose name contains `term` (case- and accent-insensitive), in the input order; a blank term keeps all. */
export function filterSeriesByName(series: BookSeriesSummaryResponse[], term: string): BookSeriesSummaryResponse[] {
  const needle = fold(term.trim());
  if (needle.length === 0) return series;
  return series.filter((s) => fold(s.name).includes(needle));
}
