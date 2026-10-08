import type { BookAuthorResponse, BookResponse, CreateBookRequest, UpdateBookRequest } from "../../../types/api";
import { normalizeCoverImageUrl, normalizeDescription, sameIds } from "../../../domain/media/draft";
import {
  validateCoverImageUrl,
  validateDescription,
  validateReleaseDate,
  validateReleaseYear,
  validateTitle,
} from "../../../domain/media/values";
import { isExistingEntry, type VocabularyDraft } from "../../../domain/media/vocabularyDraft";
import { DEFAULT_BOOK_OWNERSHIP, DEFAULT_BOOK_PROGRESS, type BookOwnership, type BookProgress } from "./bookStatus";

/** A selected author chip: an existing author or a pending free-solo name (see `VocabularyDraft`). */
export type AuthorDraft = VocabularyDraft<BookAuthorResponse>;

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
  };
}

export function draftFromBook(book: BookResponse): BookDraft {
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
  };
}

export function isDraftValid(draft: BookDraft): boolean {
  return (
    validateTitle(draft.title) === null &&
    validateReleaseYear(draft.releaseYear) === null &&
    validateReleaseDate(draft.releaseDate) === null &&
    validateDescription(draft.description) === null &&
    validateCoverImageUrl(draft.coverImageUrl) === null
  );
}

function existingAuthorIds(draft: BookDraft): string[] {
  return draft.authors.filter(isExistingEntry).map((author) => author.id);
}

/** A pending author always counts as a change: it cannot be compared to the book's ids until it is created. */
function hasPendingAuthor(draft: BookDraft): boolean {
  return draft.authors.some((author) => !isExistingEntry(author));
}

export function isDraftDirty(book: BookResponse, draft: BookDraft): boolean {
  if (hasPendingAuthor(draft)) return true;
  return Object.keys(toUpdateRequest(book, draft, existingAuthorIds(draft))).length > 0;
}

/**
 * Throws when the draft is invalid; callers keep the save button disabled until `isDraftValid`. `authorIds` is
 * the draft's authors already resolved to ids (see `resolveAuthorIds`); omitted from the request when empty, as
 * are the type ids.
 */
export function toCreateRequest(draft: BookDraft, authorIds: string[]): CreateBookRequest {
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
    ...(authorIds.length > 0 ? { authorIds } : {}),
  };
}

/**
 * Only the fields that differ from `book`; `null` clears `description`/`coverImageUrl`/`releaseDate`.
 * `authorIds` is the draft's authors already resolved to ids; type and author ids are sent only when the set
 * differs from the book's, order-insensitive.
 */
export function toUpdateRequest(book: BookResponse, draft: BookDraft, authorIds: string[]): UpdateBookRequest {
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
      authorIds,
      book.authors.map((author) => author.id),
    )
  )
    request.authorIds = authorIds;
  return request;
}
