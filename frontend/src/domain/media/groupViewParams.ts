/*
 * URL query codec of the group views (book series, authors, narrators; game developers): only the (client-side)
 * `search` term. Pure (no React, no router); the field codec lives in `domain/media/viewParams.ts`.
 */

import { parseSearch, writeSearch } from "./viewParams";

export interface GroupViewParams {
  search: string;
}

export function parseGroupViewParams(params: URLSearchParams): GroupViewParams {
  return { search: parseSearch(params) };
}

export function groupViewParams({ search }: GroupViewParams): URLSearchParams {
  const params = new URLSearchParams();
  writeSearch(params, search);
  return params;
}
