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
 * The field codecs below are exported so the watchlist and ranking views reuse the very same parsing; the
 * overview, watchlist and ranking scheme each get one parse/serialize pair at the bottom.
 */

import type { GameSort } from "../../../types/api";
import { MAX_FILTER_VALUES, type GameFilters } from "./gameFilters";
import { RELEASE_YEAR_MAX_DIGITS, RELEASE_YEAR_MIN_DIGITS, SEARCH_MAX_LENGTH } from "./gameValues";
import { OWNERSHIP_VALUES, PROGRESS_VALUES, type Ownership, type Progress } from "./gameStatus";

export const SEARCH_PARAM = "search";
export const PLATFORM_PARAM = "platform";
export const OWNERSHIP_PARAM = "ownership";
export const PROGRESS_PARAM = "progress";
export const YEAR_PARAM = "year";
export const PAGE_PARAM = "page";
export const SORT_PARAM = "sort";

// ---- field codecs ---------------------------------------------------------------------------------------------

const DIGITS = /^\d+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The backend reads `page` as an Int; larger values answer 400. */
const MAX_PAGE = 2 ** 31 - 1;

function parseNonNegativeInteger(value: string): number | null {
  if (!DIGITS.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

/** The trimmed `search` value, `""` when absent or longer than `SEARCH_MAX_LENGTH` (the backend answers 400). */
export function parseSearch(params: URLSearchParams): string {
  const search = (params.get(SEARCH_PARAM) ?? "").trim();
  return search.length <= SEARCH_MAX_LENGTH ? search : "";
}

export function writeSearch(params: URLSearchParams, search: string): void {
  const trimmed = search.trim();
  if (trimmed.length > 0) params.set(SEARCH_PARAM, trimmed);
}

/** Integer in 1..2^31-1, `1` when absent or invalid. */
export function parsePage(params: URLSearchParams): number {
  const page = parseNonNegativeInteger(params.get(PAGE_PARAM) ?? "");
  return page !== null && page >= 1 && page <= MAX_PAGE ? page : 1;
}

export function writePage(params: URLSearchParams, page: number): void {
  if (Number.isSafeInteger(page) && page > 1) params.set(PAGE_PARAM, String(page));
}

/** Platform ids that are UUIDs, lowercased (the backend's form), de-duplicated and sorted; at most `MAX_FILTER_VALUES` (the first ones). */
export function parsePlatformIds(params: URLSearchParams): string[] {
  const ids = new Set(
    params
      .getAll(PLATFORM_PARAM)
      .filter((id) => UUID.test(id))
      .map((id) => id.toLowerCase()),
  );
  return [...ids].slice(0, MAX_FILTER_VALUES).sort();
}

export function writePlatformIds(params: URLSearchParams, ids: readonly string[]): void {
  for (const id of [...new Set(ids)].filter((value) => value.length > 0).sort()) params.append(PLATFORM_PARAM, id);
}

function parseEnumValues<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T[] {
  const found = new Set<T>();
  for (const value of params.getAll(key)) {
    const match = allowed.find((candidate) => candidate === value);
    if (match !== undefined) found.add(match);
  }
  return [...found].slice(0, MAX_FILTER_VALUES).sort();
}

export function parseOwnership(params: URLSearchParams): Ownership[] {
  return parseEnumValues(params, OWNERSHIP_PARAM, OWNERSHIP_VALUES);
}

export function parseProgress(params: URLSearchParams): Progress[] {
  return parseEnumValues(params, PROGRESS_PARAM, PROGRESS_VALUES);
}

function writeValues(params: URLSearchParams, key: string, values: readonly string[]): void {
  for (const value of [...new Set(values)].sort()) params.append(key, value);
}

/** A release year the backend accepts (four digits), `null` otherwise. */
function parseReleaseYear(value: string): number | null {
  const year = parseNonNegativeInteger(value);
  return year !== null && year >= RELEASE_YEAR_MIN_DIGITS && year <= RELEASE_YEAR_MAX_DIGITS ? year : null;
}

/** Release years of the overview filter: valid years only, de-duplicated and ascending; at most `MAX_FILTER_VALUES`. */
export function parseYears(params: URLSearchParams): number[] {
  const years = new Set<number>();
  for (const value of params.getAll(YEAR_PARAM)) {
    const year = parseReleaseYear(value);
    if (year !== null) years.add(year);
  }
  return [...years].slice(0, MAX_FILTER_VALUES).sort((a, b) => a - b);
}

export function writeYears(params: URLSearchParams, years: readonly number[]): void {
  for (const year of [...new Set(years)].filter(Number.isSafeInteger).sort((a, b) => a - b)) {
    params.append(YEAR_PARAM, String(year));
  }
}

/** The single `year` of the ranking view, `null` when absent or invalid. */
export function parseSingleYear(params: URLSearchParams): number | null {
  return parseReleaseYear(params.get(YEAR_PARAM) ?? "");
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
