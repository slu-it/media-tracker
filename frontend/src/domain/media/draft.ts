/** Trimmed URL, or `null` for "no cover". */
export function normalizeCoverImageUrl(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Trimmed description, or `null` for "no description". */
export function normalizeDescription(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Sets `releaseDate`; a non-null date also overrides `releaseYear` with the date's year, since the backend
 * derives the year from the date when both are given. The one place this stays in sync, so every caller (the
 * form field, tests) goes through it instead of setting both fields separately.
 */
export function withReleaseDate<D extends { releaseYear: number | null; releaseDate: string | null }>(
  draft: D,
  releaseDate: string | null,
): D {
  if (releaseDate === null) return { ...draft, releaseDate };
  return { ...draft, releaseDate, releaseYear: Number(releaseDate.slice(0, 4)) };
}

/** Whether both id lists hold the same ids, order-insensitive. */
export function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, index) => id === sortedB[index]);
}
