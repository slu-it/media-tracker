import { apiFetch } from "../../../api/client";
import type {
  BookAuthorResponse,
  BookMetaResponse,
  BookResponse,
  BookTypeResponse,
  CreateBookAuthorRequest,
  CreateBookRequest,
  PageResponse,
  UpdateBookRequest,
} from "../../../types/api";
import { resolveVocabularyIds } from "../../../domain/media/vocabularyDraft";
import type { AuthorDraft } from "../domain/bookDraft";
import type { BookFilters } from "../domain/bookFilters";
import { AUTHOR_SEARCH_LIMIT } from "../domain/bookValues";

const BASE = "/api/books";

export function listBooks(
  page: number,
  pageSize: number,
  search: string,
  filters: BookFilters,
): Promise<PageResponse<BookResponse>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const term = search.trim();
  if (term.length > 0) query.set("search", term);
  for (const id of filters.typeIds) query.append("typeIds", id);
  for (const value of filters.ownership) query.append("ownership", value);
  for (const value of filters.progress) query.append("progress", value);
  for (const year of filters.releaseYears) query.append("releaseYear", String(year));
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
