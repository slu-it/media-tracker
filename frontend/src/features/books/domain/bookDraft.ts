import type {
  BookAuthorResponse,
  BookNarratorResponse,
  BookResponse,
  BookSeriesLinkRequest,
  BookSeriesResponse,
  CreateBookRequest,
  UpdateBookRequest,
} from "../../../types/api";
import { normalizeCoverImageUrl, normalizeDescription, sameIds } from "../../../domain/media/draft";
import {
  validateCoverImageUrl,
  validateDescription,
  validateReleaseDate,
  validateReleaseYear,
  validateTitle,
} from "../../../domain/media/values";
import { isExistingEntry, type VocabularyDraft } from "../../../domain/media/vocabularyDraft";
import { formatSeriesPositionInput, parseSeriesPosition, validateSeriesPosition } from "./bookValues";
import { DEFAULT_BOOK_OWNERSHIP, DEFAULT_BOOK_PROGRESS, type BookOwnership, type BookProgress } from "./bookStatus";

/** A selected author chip: an existing author or a pending free-solo name (see `VocabularyDraft`). */
export type AuthorDraft = VocabularyDraft<BookAuthorResponse>;

/** A selected narrator chip: an existing narrator or a pending free-solo name (see `VocabularyDraft`). */
export type NarratorDraft = VocabularyDraft<BookNarratorResponse>;

/**
 * A selected series chip plus its position as typed (`"2.5"`, `"2,5"` or empty for no number). The position stays
 * text so an in-progress or invalid edit survives; see `validateSeriesPosition`.
 */
export interface SeriesDraft {
  entry: VocabularyDraft<BookSeriesResponse>;
  position: string;
}

/** The draft's relations after resolving pending names to ids (see `resolveAuthorIds` and friends). */
export interface ResolvedBookLinks {
  authorIds: string[];
  narratorIds: string[];
  series: BookSeriesLinkRequest[];
}

/** What the form edits: raw field values, possibly incomplete or invalid. */
export interface BookDraft {
  title: string;
  releaseYear: number | null;
  /** ISO-8601 `YYYY-MM-DD`; `null` when only the release year is known. Kept in sync via `withReleaseDate` (`domain/media/draft`). */
  releaseDate: string | null;
  description: string;
  coverImageUrl: string;
  ownership: BookOwnership;
  progress: BookProgress;
  /** Zero or more; unlike games' platforms, a book needs no type. */
  typeIds: string[];
  /**
   * Existing authors and pending free-solo names (see `AuthorDraft`). The host resolves these into ids via
   * `resolveAuthorIds` right before saving; `toCreateRequest`/`toUpdateRequest` take the resolved ids instead.
   */
  authors: AuthorDraft[];
  /** Same handling as `authors`, resolved via `resolveNarratorIds`. */
  narrators: NarratorDraft[];
  /** Resolved via `resolveSeries`, which also parses the positions. */
  series: SeriesDraft[];
}

export function emptyBookDraft(): BookDraft {
  return {
    title: "",
    releaseYear: null,
    releaseDate: null,
    description: "",
    coverImageUrl: "",
    ownership: DEFAULT_BOOK_OWNERSHIP,
    progress: DEFAULT_BOOK_PROGRESS,
    typeIds: [],
    authors: [],
    narrators: [],
    series: [],
  };
}

export function draftFromBook(book: BookResponse, language: string): BookDraft {
  return {
    title: book.title,
    releaseYear: book.releaseYear,
    releaseDate: book.releaseDate,
    description: book.description ?? "",
    coverImageUrl: book.coverImageUrl ?? "",
    ownership: book.ownership,
    progress: book.progress,
    typeIds: book.types.map((type) => type.id),
    authors: book.authors,
    narrators: book.narrators,
    series: book.series.map((entry) => ({
      entry: { id: entry.id, name: entry.name },
      position: formatSeriesPositionInput(entry.position, language),
    })),
  };
}

export function isDraftValid(draft: BookDraft): boolean {
  return (
    validateTitle(draft.title) === null &&
    validateReleaseYear(draft.releaseYear) === null &&
    validateReleaseDate(draft.releaseDate) === null &&
    validateDescription(draft.description) === null &&
    validateCoverImageUrl(draft.coverImageUrl) === null &&
    draft.series.every((series) => validateSeriesPosition(series.position) === null)
  );
}

function existingIds(entries: VocabularyDraft[]): string[] {
  return entries.filter(isExistingEntry).map((entry) => entry.id);
}

/** The links of the already existing series; the pending ones have no id yet. */
function existingSeriesLinks(draft: BookDraft): BookSeriesLinkRequest[] {
  const links: BookSeriesLinkRequest[] = [];
  for (const { entry, position } of draft.series) {
    if (isExistingEntry(entry)) links.push({ seriesId: entry.id, position: parseSeriesPosition(position) });
  }
  return links;
}

function seriesLinkKeys(links: BookSeriesLinkRequest[]): string[] {
  return links.map((link) => `${link.seriesId}|${link.position ?? ""}`);
}

function sameSeriesLinks(a: BookSeriesLinkRequest[], b: BookSeriesLinkRequest[]): boolean {
  const left = new Set(seriesLinkKeys(a));
  const right = new Set(seriesLinkKeys(b));
  return left.size === right.size && [...left].every((key) => right.has(key));
}

/** A pending name always counts as a change: it cannot be compared to the book's ids until it is created. */
function hasPendingEntry(draft: BookDraft): boolean {
  return (
    draft.authors.some((author) => !isExistingEntry(author)) ||
    draft.narrators.some((narrator) => !isExistingEntry(narrator)) ||
    draft.series.some((series) => !isExistingEntry(series.entry))
  );
}

export function isDraftDirty(book: BookResponse, draft: BookDraft): boolean {
  if (hasPendingEntry(draft)) return true;
  const links: ResolvedBookLinks = {
    authorIds: existingIds(draft.authors),
    narratorIds: existingIds(draft.narrators),
    series: existingSeriesLinks(draft),
  };
  return Object.keys(toUpdateRequest(book, draft, links)).length > 0;
}

/**
 * Throws when the draft is invalid; callers keep the save button disabled until `isDraftValid`. `links` is the
 * draft's authors, narrators and series already resolved (see `resolveAuthorIds`, `resolveNarratorIds`,
 * `resolveSeries`); each is omitted from the request when empty, as are the type ids.
 */
export function toCreateRequest(draft: BookDraft, links: ResolvedBookLinks): CreateBookRequest {
  if (!isDraftValid(draft) || draft.releaseYear === null) {
    throw new Error("draft is not valid");
  }
  return {
    title: draft.title.trim(),
    releaseYear: draft.releaseYear,
    releaseDate: draft.releaseDate,
    description: normalizeDescription(draft.description),
    coverImageUrl: normalizeCoverImageUrl(draft.coverImageUrl),
    ownership: draft.ownership,
    progress: draft.progress,
    ...(draft.typeIds.length > 0 ? { typeIds: draft.typeIds } : {}),
    ...(links.authorIds.length > 0 ? { authorIds: links.authorIds } : {}),
    ...(links.narratorIds.length > 0 ? { narratorIds: links.narratorIds } : {}),
    ...(links.series.length > 0 ? { series: links.series } : {}),
  };
}

/**
 * Only the fields that differ from `book`; `null` clears `description`/`coverImageUrl`/`releaseDate`.
 * `links` is the draft's authors, narrators and series already resolved; type, author and narrator ids are sent
 * only when the set differs from the book's, order-insensitive, and the series only when the set of
 * (series, position) pairs differs.
 */
export function toUpdateRequest(book: BookResponse, draft: BookDraft, links: ResolvedBookLinks): UpdateBookRequest {
  const request: UpdateBookRequest = {};
  const title = draft.title.trim();
  if (title !== book.title) request.title = title;
  if (draft.releaseYear !== null && draft.releaseYear !== book.releaseYear) request.releaseYear = draft.releaseYear;
  if (draft.releaseDate !== book.releaseDate) request.releaseDate = draft.releaseDate;
  const description = normalizeDescription(draft.description);
  if (description !== book.description) request.description = description;
  const cover = normalizeCoverImageUrl(draft.coverImageUrl);
  if (cover !== book.coverImageUrl) request.coverImageUrl = cover;
  if (draft.ownership !== book.ownership) request.ownership = draft.ownership;
  if (draft.progress !== book.progress) request.progress = draft.progress;
  if (
    !sameIds(
      draft.typeIds,
      book.types.map((type) => type.id),
    )
  )
    request.typeIds = draft.typeIds;
  if (
    !sameIds(
      links.authorIds,
      book.authors.map((author) => author.id),
    )
  )
    request.authorIds = links.authorIds;
  if (
    !sameIds(
      links.narratorIds,
      book.narrators.map((narrator) => narrator.id),
    )
  )
    request.narratorIds = links.narratorIds;
  if (
    !sameSeriesLinks(
      links.series,
      book.series.map((entry) => ({ seriesId: entry.id, position: entry.position })),
    )
  )
    request.series = links.series;
  return request;
}
