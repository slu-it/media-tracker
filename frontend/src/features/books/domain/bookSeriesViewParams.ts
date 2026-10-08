/*
 * URL query codec of the book series view: only the (client-side) `search` term. Pure (no React, no router); the
 * field codec lives in `domain/media/viewParams.ts`.
 */

import { parseSearch, writeSearch } from "../../../domain/media/viewParams";

export interface BookSeriesViewParams {
  search: string;
}

export function parseBookSeriesViewParams(params: URLSearchParams): BookSeriesViewParams {
  return { search: parseSearch(params) };
}

export function bookSeriesViewParams({ search }: BookSeriesViewParams): URLSearchParams {
  const params = new URLSearchParams();
  writeSearch(params, search);
  return params;
}
