/*
 * Frontend mirror of the backend `GameFilters` (games/domain/GameFilters.kt). An empty array in any field means
 * "no filter on that field"; several values within one field OR together, the four fields AND together.
 *
 * `sort` and `rated` (MT-026) are not part of this type: every field here is a multi-value OR-filter with an
 * empty-array "no filter" default, while `rated` is a single on/off toggle and `sort` picks an ordering, not a
 * subset. Both are passed as separate, trailing optional arguments to `listGames`/`listAllGames` and the
 * `useGamesPage`/`useAllGames` hooks instead of being folded into `GameFilters` and `filtersKey`.
 */

import type { Ownership, Progress } from "../../../types/api";

/** Mirrors `MAX_FILTER_VALUES` (backend): the most values one repeatable filter may carry before the API answers 400. */
export const MAX_FILTER_VALUES = 50;

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
