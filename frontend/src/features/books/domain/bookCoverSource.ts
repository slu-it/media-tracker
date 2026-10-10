import type { BookCoverSource } from "../../../types/api";

/** The seeded "Audible" book type (migration), recognised even when its label was renamed. */
export const AUDIBLE_TYPE_ID = "6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0004";

export const BOOK_COVER_SOURCES: BookCoverSource[] = ["book", "audiobook"];

/**
 * The cover and suggestion source a book starts with: `audiobook` when one of its types is Audible (by name,
 * trimmed and case-insensitive, or by the seeded id) or when it has narrators, else `book`.
 */
export function defaultCoverSource(book: {
  types: { id: string; label: string }[];
  narrators: unknown[];
}): BookCoverSource {
  const audible = book.types.some(
    (type) => type.id === AUDIBLE_TYPE_ID || type.label.trim().toLowerCase() === "audible",
  );
  return audible || book.narrators.length > 0 ? "audiobook" : "book";
}
