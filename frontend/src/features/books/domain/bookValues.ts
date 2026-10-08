/*
 * Frontend mirror of the books-specific constants; the kind-neutral validators live in
 * `domain/media/values.ts`.
 */

/** Books per grid page. Sent explicitly on every request, so it is independent of the backend default. */
export const BOOKS_PAGE_SIZE = 36;

/** Width / height of a book cover frame (2:3, the usual paperback proportion). */
export const BOOK_COVER_ASPECT_RATIO = 2 / 3;

/** Mirrors the backend's author search limit; the author chip input asks for at most this many matches. */
export const AUTHOR_SEARCH_LIMIT = 10;

/** Oldest year offered by the book year selector (classics predate games by centuries). */
export const BOOK_RELEASE_YEAR_SELECT_MIN = 1450;
