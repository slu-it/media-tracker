/*
 * URL query codecs of the games sub-pages (MT-032): every view keeps its state (search, filters, page, ...) in
 * the query string so it survives reloads and can be linked to. Pure (no React, no router): `parse*` reads a
 * `URLSearchParams` and `*Params` writes one.
 *
 * Rules shared by all codecs:
 * - invalid values are dropped silently, nothing throws;
 * - a default or empty value is omitted when serializing;
 * - repeatable params are written as `?k=a&k=b`, de-duplicated and sorted, and keys come in a fixed order, so
 *   equal state always serializes to the same URL.
 *
 * The kind-neutral field codecs live in `domain/media/viewParams.ts`; the overview, watchlist and ranking scheme
 * each get one parse/serialize pair here.
 */

import type { GameSort } from "../../../types/api";
import {
  parseEnumValues,
  parsePage,
  parseSearch,
  parseSingleYear,
  parseUuids,
  parseYears,
  writePage,
  writeSearch,
  writeUuids,
  writeValues,
  writeYears,
  YEAR_PARAM,
} from "../../../domain/media/viewParams";
import type { GameFilters } from "./gameFilters";
import { OWNERSHIP_VALUES, PROGRESS_VALUES, type Ownership, type Progress } from "./gameStatus";

export const PLATFORM_PARAM = "platform";
export const OWNERSHIP_PARAM = "ownership";
export const PROGRESS_PARAM = "progress";
export const SORT_PARAM = "sort";

// ---- field codecs ---------------------------------------------------------------------------------------------

/** Platform ids that are UUIDs, lowercased (the backend's form), de-duplicated and sorted; at most `MAX_FILTER_VALUES` (the first ones). */
export function parsePlatformIds(params: URLSearchParams): string[] {
  return parseUuids(params, PLATFORM_PARAM);
}

export function writePlatformIds(params: URLSearchParams, ids: readonly string[]): void {
  writeUuids(params, PLATFORM_PARAM, ids);
}

export function parseOwnership(params: URLSearchParams): Ownership[] {
  return parseEnumValues(params, OWNERSHIP_PARAM, OWNERSHIP_VALUES);
}

export function parseProgress(params: URLSearchParams): Progress[] {
  return parseEnumValues(params, PROGRESS_PARAM, PROGRESS_VALUES);
}

// ---- overview -------------------------------------------------------------------------------------------------

export interface OverviewParams {
  search: string;
  page: number;
  filters: GameFilters;
}

/** `search`, `platform`*, `ownership`*, `progress`*, `year`*, `page`. */
export function parseOverviewParams(params: URLSearchParams): OverviewParams {
  const filters: GameFilters = {
    platformIds: parsePlatformIds(params),
    ownership: parseOwnership(params),
    progress: parseProgress(params),
    releaseYears: parseYears(params),
  };
  return { search: parseSearch(params), page: parsePage(params), filters };
}

export function overviewParams({ search, page, filters }: OverviewParams): URLSearchParams {
  const params = new URLSearchParams();
  writeSearch(params, search);
  writePlatformIds(params, filters.platformIds);
  writeValues(params, OWNERSHIP_PARAM, filters.ownership);
  writeValues(params, PROGRESS_PARAM, filters.progress);
  writeYears(params, filters.releaseYears);
  writePage(params, page);
  return params;
}

// ---- watchlist ------------------------------------------------------------------------------------------------

export const WATCHLIST_SORTS = ["release_asc", "release_desc"] as const satisfies readonly GameSort[];
export type WatchlistSort = (typeof WATCHLIST_SORTS)[number];
export const DEFAULT_WATCHLIST_SORT: WatchlistSort = "release_asc";

export interface WatchlistParams {
  search: string;
  platformIds: string[];
  sort: WatchlistSort;
  page: number;
}

/** `search`, `platform`*, `sort` (`release_desc` only; `release_asc` is the default), `page`. */
export function parseWatchlistParams(params: URLSearchParams): WatchlistParams {
  return {
    search: parseSearch(params),
    platformIds: parsePlatformIds(params),
    sort: WATCHLIST_SORTS.find((sort) => sort === params.get(SORT_PARAM)) ?? DEFAULT_WATCHLIST_SORT,
    page: parsePage(params),
  };
}

export function watchlistParams({ search, platformIds, sort, page }: WatchlistParams): URLSearchParams {
  const params = new URLSearchParams();
  writeSearch(params, search);
  writePlatformIds(params, platformIds);
  if (sort !== DEFAULT_WATCHLIST_SORT) params.set(SORT_PARAM, sort);
  writePage(params, page);
  return params;
}

// ---- ranking --------------------------------------------------------------------------------------------------

export interface RankingParams {
  /** `null` = no year in the URL; the view then falls back to its own default. */
  year: number | null;
}

export function parseRankingParams(params: URLSearchParams): RankingParams {
  return { year: parseSingleYear(params) };
}

export function rankingParams({ year }: RankingParams): URLSearchParams {
  const params = new URLSearchParams();
  if (year !== null && Number.isSafeInteger(year)) params.set(YEAR_PARAM, String(year));
  return params;
}
