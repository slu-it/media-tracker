/*
 * URL query codec of the group views (book series, authors, narrators; game developers): the (client-side)
 * `search` term and `sort`. Pure (no React, no router); the field codec lives in `domain/media/viewParams.ts`.
 */

import { parseSearch, writeSearch } from "./viewParams";

/** `name`: the backend's alphabetical order; `volume`: most items first. */
export type GroupSort = "name" | "volume";

export const DEFAULT_GROUP_SORT: GroupSort = "name";
export const SORT_PARAM = "sort";

export interface GroupViewParams {
  search: string;
  sort: GroupSort;
}

export function parseGroupViewParams(params: URLSearchParams): GroupViewParams {
  const sort = params.get(SORT_PARAM) === "volume" ? "volume" : DEFAULT_GROUP_SORT;
  return { search: parseSearch(params), sort };
}

export function groupViewParams({ search, sort }: GroupViewParams): URLSearchParams {
  const params = new URLSearchParams();
  writeSearch(params, search);
  if (sort !== DEFAULT_GROUP_SORT) params.set(SORT_PARAM, sort);
  return params;
}
