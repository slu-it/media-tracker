/*
 * Frontend mirror of the backend `GameFilters` (games/domain/GameFilters.kt). An empty array in any field means
 * "no filter on that field"; several values within one field OR together, the four fields AND together.
 */

import type { Ownership, Progress } from "../../../types/api";

export interface GameFilters {
  platformIds: string[];
  ownership: Ownership[];
  progress: Progress[];
  releaseYears: number[];
}

export const EMPTY_FILTERS: GameFilters = { platformIds: [], ownership: [], progress: [], releaseYears: [] };

export function hasActiveFilters(filters: GameFilters): boolean {
  return (
    filters.platformIds.length > 0 ||
    filters.ownership.length > 0 ||
    filters.progress.length > 0 ||
    filters.releaseYears.length > 0
  );
}

/**
 * A stable string identifying the current selection, independent of the order the values were picked in; used
 * both as an effect dependency and as the value paired with the page number.
 */
export function filtersKey(filters: GameFilters): string {
  return [
    [...filters.platformIds].sort().join(","),
    [...filters.ownership].sort().join(","),
    [...filters.progress].sort().join(","),
    [...filters.releaseYears].sort((a, b) => a - b).join(","),
  ].join("|");
}
