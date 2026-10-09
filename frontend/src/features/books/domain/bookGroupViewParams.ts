/*
 * URL query codec of the book groups views (series, authors): only the (client-side) `search` term. Pure (no React, no router); the
 * field codec lives in `domain/media/viewParams.ts`.
 */

import { parseSearch, writeSearch } from "../../../domain/media/viewParams";

export interface BookGroupViewParams {
  search: string;
}

export function parseBookGroupViewParams(params: URLSearchParams): BookGroupViewParams {
  return { search: parseSearch(params) };
}

export function bookGroupViewParams({ search }: BookGroupViewParams): URLSearchParams {
  const params = new URLSearchParams();
  writeSearch(params, search);
  return params;
}
