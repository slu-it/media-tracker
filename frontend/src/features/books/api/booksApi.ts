import { apiFetch } from "../../../api/client";
import type {
  BookAuthorResponse,
  BookAuthorSummaryResponse,
  BookMetaResponse,
  BookNarratorResponse,
  BookResponse,
  BookSeriesLinkRequest,
  BookSeriesResponse,
  BookSeriesSummaryResponse,
  BookSort,
  BookTypeResponse,
  CreateBookAuthorRequest,
  CreateBookNarratorRequest,
  CreateBookRequest,
  CreateBookSeriesRequest,
  PageResponse,
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
