/*
 * URL query codec of the books overview: the view keeps its state (search, filters, page) in the query string so
 * it survives reloads and can be linked to. Pure (no React, no router). The shared rules (invalid values are
 * dropped, defaults omitted, repeatable params sorted and de-duplicated) and the field codecs live in
 * `domain/media/viewParams.ts`.
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
