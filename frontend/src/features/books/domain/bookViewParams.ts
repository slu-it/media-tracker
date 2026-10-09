/*
 * URL query codecs of the books sub-pages: every view keeps its state (search, filters, page, ...) in the query
 * string so it survives reloads and can be linked to. Pure (no React, no router): one `parse*`/`*Params` pair per
 * sub-page. The shared rules (invalid values are dropped, defaults omitted, repeatable params sorted and
 * de-duplicated) and the field codecs live in `domain/media/viewParams.ts`.
 */

import {
  parseEnumValues,
  parsePage,
  parseSearch,
  parseUuids,
  parseYears,
  writePage,
  writeSearch,
  writeUuids,
  writeValues,
  writeYears,
} from "../../../domain/media/viewParams";
import type { BookSort } from "../../../types/api";
import type { BookFilters } from "./bookFilters";
import { BOOK_OWNERSHIP_VALUES, BOOK_PROGRESS_VALUES } from "./bookStatus";

export const TYPE_PARAM = "type";
export const OWNERSHIP_PARAM = "ownership";
export const PROGRESS_PARAM = "progress";

export interface BookOverviewParams {
  search: string;
  page: number;
  filters: BookFilters;
}

/** `search`, `type`*, `ownership`*, `progress`*, `year`*, `page`. */
export function parseBookOverviewParams(params: URLSearchParams): BookOverviewParams {
  const filters: BookFilters = {
    typeIds: parseUuids(params, TYPE_PARAM),
    ownership: parseEnumValues(params, OWNERSHIP_PARAM, BOOK_OWNERSHIP_VALUES),
    progress: parseEnumValues(params, PROGRESS_PARAM, BOOK_PROGRESS_VALUES),
    releaseYears: parseYears(params),
  };
  return { search: parseSearch(params), page: parsePage(params), filters };
}

export function bookOverviewParams({ search, page, filters }: BookOverviewParams): URLSearchParams {
  const params = new URLSearchParams();
  writeSearch(params, search);
  writeUuids(params, TYPE_PARAM, filters.typeIds);
  writeValues(params, OWNERSHIP_PARAM, filters.ownership);
  writeValues(params, PROGRESS_PARAM, filters.progress);
  writeYears(params, filters.releaseYears);
  writePage(params, page);
  return params;
}

// ---- watchlist ------------------------------------------------------------------------------------------------

export const SORT_PARAM = "sort";
export const WATCHLIST_SORTS = ["release_asc", "release_desc"] as const satisfies readonly BookSort[];
export type WatchlistSort = (typeof WATCHLIST_SORTS)[number];
export const DEFAULT_WATCHLIST_SORT: WatchlistSort = "release_asc";

export interface BookWatchlistParams {
  search: string;
  typeIds: string[];
  sort: WatchlistSort;
  page: number;
}

/** `search`, `type`*, `sort` (`release_desc` only; `release_asc` is the default), `page`. */
export function parseBookWatchlistParams(params: URLSearchParams): BookWatchlistParams {
  return {
    search: parseSearch(params),
    typeIds: parseUuids(params, TYPE_PARAM),
    sort: WATCHLIST_SORTS.find((sort) => sort === params.get(SORT_PARAM)) ?? DEFAULT_WATCHLIST_SORT,
    page: parsePage(params),
  };
}

export function bookWatchlistParams({ search, typeIds, sort, page }: BookWatchlistParams): URLSearchParams {
  const params = new URLSearchParams();
  writeSearch(params, search);
  writeUuids(params, TYPE_PARAM, typeIds);
  if (sort !== DEFAULT_WATCHLIST_SORT) params.set(SORT_PARAM, sort);
  writePage(params, page);
  return params;
}
