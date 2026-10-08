/*
 * Frontend mirror of the backend book filters. An empty array in any field means "no filter on that field";
 * several values within one field OR together, the four fields AND together.
 */

import type { BookOwnership, BookProgress } from "../../../types/api";

export interface BookFilters {
  typeIds: string[];
  ownership: BookOwnership[];
  progress: BookProgress[];
  releaseYears: number[];
}

export const EMPTY_BOOK_FILTERS: BookFilters = { typeIds: [], ownership: [], progress: [], releaseYears: [] };

export function hasActiveBookFilters(filters: BookFilters): boolean {
  return (
    filters.typeIds.length > 0 ||
    filters.ownership.length > 0 ||
    filters.progress.length > 0 ||
    filters.releaseYears.length > 0
  );
}

/**
 * A stable string identifying the current selection, independent of the order the values were picked in; used
 * both as an effect dependency and as the value paired with the page number.
 */
export function bookFiltersKey(filters: BookFilters): string {
  return [
    [...filters.typeIds].sort().join(","),
    [...filters.ownership].sort().join(","),
    [...filters.progress].sort().join(","),
    [...filters.releaseYears].sort((a, b) => a - b).join(","),
  ].join("|");
}
