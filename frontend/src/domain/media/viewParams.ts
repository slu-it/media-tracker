/*
 * Field codecs of the URL query of a media view: every view keeps its state (search, filters, page, ...) in the
 * query string so it survives reloads and can be linked to. Pure (no React, no router): `parse*` reads a
 * `URLSearchParams` and `write*` writes one. The per-kind schemes (`features/<kind>/domain/*ViewParams.ts`)
 * compose them.
 *
 * Rules shared by all codecs:
 * - invalid values are dropped silently, nothing throws;
 * - a default or empty value is omitted when serializing;
 * - repeatable params are written as `?k=a&k=b`, de-duplicated and sorted, and keys come in a fixed order, so
 *   equal state always serializes to the same URL.
 */

import { RELEASE_YEAR_MAX_DIGITS, RELEASE_YEAR_MIN_DIGITS, SEARCH_MAX_LENGTH } from "./values";

export const SEARCH_PARAM = "search";
export const YEAR_PARAM = "year";
export const PAGE_PARAM = "page";

/** Mirrors `MAX_FILTER_VALUES` (backend): the most values one repeatable filter may carry before the API answers 400. */
export const MAX_FILTER_VALUES = 50;

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

/** Values of `key` that are UUIDs, lowercased (the backend's form), de-duplicated and sorted; at most `MAX_FILTER_VALUES` (the first ones). */
export function parseUuids(params: URLSearchParams, key: string): string[] {
  const ids = new Set(
    params
      .getAll(key)
      .filter((id) => UUID.test(id))
      .map((id) => id.toLowerCase()),
  );
  return [...ids].slice(0, MAX_FILTER_VALUES).sort();
}

export function writeUuids(params: URLSearchParams, key: string, ids: readonly string[]): void {
  for (const id of [...new Set(ids)].filter((value) => value.length > 0).sort()) params.append(key, id);
}

export function parseEnumValues<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T[] {
  const found = new Set<T>();
  for (const value of params.getAll(key)) {
    const match = allowed.find((candidate) => candidate === value);
    if (match !== undefined) found.add(match);
  }
  return [...found].slice(0, MAX_FILTER_VALUES).sort();
}

export function writeValues(params: URLSearchParams, key: string, values: readonly string[]): void {
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
