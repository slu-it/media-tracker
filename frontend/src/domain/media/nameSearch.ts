/** Lower-cased and without accents ("Éowyn" becomes "eowyn"), roughly like the backend's `uca1400_ai_ci` collation. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Items whose name contains `term` (case- and accent-insensitive), in the input order; a blank term keeps all. */
export function filterByName<T extends { name: string }>(items: T[], term: string): T[] {
  const needle = fold(term.trim());
  if (needle.length === 0) return items;
  return items.filter((item) => fold(item.name).includes(needle));
}
