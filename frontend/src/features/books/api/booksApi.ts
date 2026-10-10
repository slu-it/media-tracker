import { apiFetch } from "../../../api/client";
import type {
  BookAuthorResponse,
  BookAuthorSummaryResponse,
  BookNarratorSummaryResponse,
  BookCoverOptionsResponse,
  BookCoverSource,
  BookMetaResponse,
  BookNarratorResponse,
  BookResponse,
  BookSeriesLinkRequest,
  BookSeriesResponse,
  BookSeriesSummaryResponse,
  BookSort,
  BookTitleSuggestionsResponse,
  BookTypeResponse,
  CreateBookAuthorRequest,
  CreateBookNarratorRequest,
  CreateBookRequest,
  CreateBookSeriesRequest,
  MergeVocabularyRequest,
  PageResponse,
  RenameVocabularyRequest,
  UpdateBookRequest,
} from "../../../types/api";
import { resolveVocabularyEntries, resolveVocabularyIds } from "../../../domain/media/vocabularyDraft";
import type { AuthorDraft, NarratorDraft, SeriesDraft } from "../domain/bookDraft";
import type { BookFilters } from "../domain/bookFilters";
import {
  AUTHOR_SEARCH_LIMIT,
  NARRATOR_SEARCH_LIMIT,
  SERIES_SEARCH_LIMIT,
  parseSeriesPosition,
} from "../domain/bookValues";

const BASE = "/api/books";

export function listBooks(
  page: number,
  pageSize: number,
  search: string,
  filters: BookFilters,
  sort?: BookSort,
): Promise<PageResponse<BookResponse>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const term = search.trim();
  if (term.length > 0) query.set("search", term);
  for (const id of filters.typeIds) query.append("typeIds", id);
  for (const value of filters.ownership) query.append("ownership", value);
  for (const value of filters.progress) query.append("progress", value);
  for (const year of filters.releaseYears) query.append("releaseYear", String(year));
  // "title" is the backend default: omitting it keeps existing request URLs unchanged.
  if (sort !== undefined && sort !== "title") query.set("sort", sort);
  return apiFetch<PageResponse<BookResponse>>(`${BASE}?${query}`);
}

export function getBooksMeta(): Promise<BookMetaResponse> {
  return apiFetch<BookMetaResponse>("/api/books.meta");
}

export function listBookTypes(): Promise<BookTypeResponse[]> {
  return apiFetch<BookTypeResponse[]>("/api/book-types");
}

export function createBook(body: CreateBookRequest): Promise<BookResponse> {
  return apiFetch<BookResponse>(BASE, { method: "POST", body: JSON.stringify(body) });
}

export function updateBook(id: string, body: UpdateBookRequest): Promise<BookResponse> {
  return apiFetch<BookResponse>(`${BASE}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
}

/** 204 for existing and unknown ids alike. */
export function deleteBook(id: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** 204; 409 while books still use the author, 404 for an unknown id. */
export function deleteBookAuthor(id: string): Promise<void> {
  return apiFetch<void>(`/api/book-authors/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** 204; 409 while books still use the narrator, 404 for an unknown id. */
export function deleteBookNarrator(id: string): Promise<void> {
  return apiFetch<void>(`/api/book-narrators/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** 204; 409 while books still use the series, 404 for an unknown id. */
export function deleteBookSeries(id: string): Promise<void> {
  return apiFetch<void>(`/api/book-series/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Renames the author; 409 `name_taken` (with `existingId`/`existingName`) when another author has the name. */
export function renameBookAuthor(id: string, name: string): Promise<BookAuthorResponse> {
  const body: RenameVocabularyRequest = { name };
  return apiFetch<BookAuthorResponse>(`/api/book-authors/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Moves every book of the author to `targetId` and deletes the author; resolves the target. */
export function mergeBookAuthor(id: string, targetId: string): Promise<BookAuthorResponse> {
  const body: MergeVocabularyRequest = { targetId };
  return apiFetch<BookAuthorResponse>(`/api/book-authors/${encodeURIComponent(id)}/merge`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Renames the narrator; 409 `name_taken` (with `existingId`/`existingName`) when another narrator has the name. */
export function renameBookNarrator(id: string, name: string): Promise<BookNarratorResponse> {
  const body: RenameVocabularyRequest = { name };
  return apiFetch<BookNarratorResponse>(`/api/book-narrators/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Moves every book of the narrator to `targetId` and deletes the narrator; resolves the target. */
export function mergeBookNarrator(id: string, targetId: string): Promise<BookNarratorResponse> {
  const body: MergeVocabularyRequest = { targetId };
  return apiFetch<BookNarratorResponse>(`/api/book-narrators/${encodeURIComponent(id)}/merge`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Renames the series; 409 `name_taken` (with `existingId`/`existingName`) when another series has the name. */
export function renameBookSeries(id: string, name: string): Promise<BookSeriesResponse> {
  const body: RenameVocabularyRequest = { name };
  return apiFetch<BookSeriesResponse>(`/api/book-series/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Moves every book of the series to `targetId` and deletes the series; resolves the target. */
export function mergeBookSeries(id: string, targetId: string): Promise<BookSeriesResponse> {
  const body: MergeVocabularyRequest = { targetId };
  return apiFetch<BookSeriesResponse>(`/api/book-series/${encodeURIComponent(id)}/merge`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Book-independent: matches for the author chip input, capped at `AUTHOR_SEARCH_LIMIT`. `signal` lets a caller
 * abort a stale request when the search term changes again before this one resolves. Module-level, so its
 * identity is stable for hooks that take it as a dependency.
 */
export function searchBookAuthors(search: string, signal?: AbortSignal): Promise<BookAuthorResponse[]> {
  const params = new URLSearchParams({ search: search.trim(), limit: String(AUTHOR_SEARCH_LIMIT) });
  return apiFetch<BookAuthorResponse[]>(`/api/book-authors?${params}`, { signal });
}

/** Adds `name` to the author vocabulary; the backend returns the existing author (200) if it already exists. */
export function createBookAuthor(name: string): Promise<BookAuthorResponse> {
  const body: CreateBookAuthorRequest = { name };
  return apiFetch<BookAuthorResponse>("/api/book-authors", { method: "POST", body: JSON.stringify(body) });
}

/** Resolves a book form draft's authors to ids right before saving (see `resolveVocabularyIds`). */
export function resolveAuthorIds(drafts: AuthorDraft[]): Promise<string[]> {
  return resolveVocabularyIds(drafts, createBookAuthor);
}

/** Like `searchBookAuthors`, for the narrator chip input, capped at `NARRATOR_SEARCH_LIMIT`. */
export function searchBookNarrators(search: string, signal?: AbortSignal): Promise<BookNarratorResponse[]> {
  const params = new URLSearchParams({ search: search.trim(), limit: String(NARRATOR_SEARCH_LIMIT) });
  return apiFetch<BookNarratorResponse[]>(`/api/book-narrators?${params}`, { signal });
}

/** Adds `name` to the narrator vocabulary; the backend returns the existing narrator (200) if it already exists. */
export function createBookNarrator(name: string): Promise<BookNarratorResponse> {
  const body: CreateBookNarratorRequest = { name };
  return apiFetch<BookNarratorResponse>("/api/book-narrators", { method: "POST", body: JSON.stringify(body) });
}

/** Resolves a book form draft's narrators to ids right before saving (see `resolveVocabularyIds`). */
export function resolveNarratorIds(drafts: NarratorDraft[]): Promise<string[]> {
  return resolveVocabularyIds(drafts, createBookNarrator);
}

/** Like `searchBookAuthors`, for the series chip input, capped at `SERIES_SEARCH_LIMIT`. */
export function searchBookSeries(search: string, signal?: AbortSignal): Promise<BookSeriesResponse[]> {
  const params = new URLSearchParams({ search: search.trim(), limit: String(SERIES_SEARCH_LIMIT) });
  return apiFetch<BookSeriesResponse[]>(`/api/book-series?${params}`, { signal });
}

/** Adds `name` to the series vocabulary; the backend returns the existing series (200) if it already exists. */
export function createBookSeries(name: string): Promise<BookSeriesResponse> {
  const body: CreateBookSeriesRequest = { name };
  return apiFetch<BookSeriesResponse>("/api/book-series", { method: "POST", body: JSON.stringify(body) });
}

/**
 * Resolves a book form draft's series to links right before saving: pending names are created, each position
 * text is parsed (empty means no number), and a series selected twice (a pending name that resolved to an
 * existing one) keeps its first link that has a position, else its first.
 */
export async function resolveSeries(drafts: SeriesDraft[]): Promise<BookSeriesLinkRequest[]> {
  const entries = await resolveVocabularyEntries(
    drafts.map((draft) => draft.entry),
    createBookSeries,
  );
  const links = new Map<string, BookSeriesLinkRequest>();
  entries.forEach((entry, index) => {
    const position = parseSeriesPosition(drafts[index].position);
    // The first link wins, unless it has no position and a later duplicate has one.
    if (links.get(entry.id)?.position == null) {
      links.set(entry.id, { seriesId: entry.id, position });
    }
  });
  return [...links.values()];
}

/** Every series with its book count (including 0), alphabetical; unpaged. */
export function listBookSeriesSummaries(): Promise<BookSeriesSummaryResponse[]> {
  return apiFetch<BookSeriesSummaryResponse[]>("/api/book-series.summaries");
}

/** The books of one series in position order (unnumbered last, then by title); 404 for an unknown series. */
export function listSeriesBooks(seriesId: string, signal?: AbortSignal): Promise<BookResponse[]> {
  return apiFetch<BookResponse[]>(`/api/book-series/${encodeURIComponent(seriesId)}/books`, { signal });
}

/** Every author with their book count (including 0), by name; unpaged. */
export function listBookAuthorSummaries(): Promise<BookAuthorSummaryResponse[]> {
  return apiFetch<BookAuthorSummaryResponse[]>("/api/book-authors.summaries");
}

/** The books of one author by release year, release date (none last) and title; 404 for an unknown author. */
export function listAuthorBooks(authorId: string, signal?: AbortSignal): Promise<BookResponse[]> {
  return apiFetch<BookResponse[]>(`/api/book-authors/${encodeURIComponent(authorId)}/books`, { signal });
}

/** Every narrator with their book count (including 0), by name; unpaged. */
export function listBookNarratorSummaries(): Promise<BookNarratorSummaryResponse[]> {
  return apiFetch<BookNarratorSummaryResponse[]>("/api/book-narrators.summaries");
}

/** The books of one narrator by release year, release date (none last) and title; 404 for an unknown narrator. */
export function listNarratorBooks(narratorId: string, signal?: AbortSignal): Promise<BookResponse[]> {
  return apiFetch<BookResponse[]>(`/api/book-narrators/${encodeURIComponent(narratorId)}/books`, { signal });
}

/**
 * Cover options of the Open Library (`book`) or Audible (`audiobook`) source; `query` is required by the backend.
 * `releaseYear`, `match`, `source` and `page` are appended only when given, and the backend defaults `source` to
 * `"book"` and `page` to `1`, so the default source is never put on the wire (as for games' `type`).
 */
export function getBookCoverOptions(params: {
  query: string;
  releaseYear?: number | null;
  match?: string;
  source?: BookCoverSource;
  page?: number;
}): Promise<BookCoverOptionsResponse> {
  const query = new URLSearchParams({ query: params.query.trim() });
  if (typeof params.releaseYear === "number") query.set("releaseYear", String(params.releaseYear));
  if (params.match !== undefined) query.set("match", params.match);
  if (params.source !== undefined && params.source !== "book") query.set("source", params.source);
  if (params.page !== undefined) query.set("page", String(params.page));
  return apiFetch<BookCoverOptionsResponse>(`${BASE}/cover-options?${query}`);
}

/** Title suggestions from the given source for the add/edit form; always 200, an upstream failure yields none. */
export function getBookTitleSuggestions(query: string, source: BookCoverSource): Promise<BookTitleSuggestionsResponse> {
  const params = new URLSearchParams({ query: query.trim() });
  if (source !== "book") params.set("source", source);
  return apiFetch<BookTitleSuggestionsResponse>(`${BASE}/title-suggestions?${params}`);
}
