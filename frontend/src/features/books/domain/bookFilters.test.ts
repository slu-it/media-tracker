import { describe, expect, it } from "vitest";
import { EMPTY_BOOK_FILTERS, bookFiltersKey, hasActiveBookFilters, type BookFilters } from "./bookFilters";

describe("bookFilters", () => {
  it("has no active filters by default", () => {
    expect(hasActiveBookFilters(EMPTY_BOOK_FILTERS)).toBe(false);
  });

  it("is active as soon as any single field is non-empty", () => {
    expect(hasActiveBookFilters({ ...EMPTY_BOOK_FILTERS, typeIds: ["type-1"] })).toBe(true);
    expect(hasActiveBookFilters({ ...EMPTY_BOOK_FILTERS, ownership: ["owned"] })).toBe(true);
    expect(hasActiveBookFilters({ ...EMPTY_BOOK_FILTERS, progress: ["reading"] })).toBe(true);
    expect(hasActiveBookFilters({ ...EMPTY_BOOK_FILTERS, releaseYears: [1965] })).toBe(true);
  });

  it("gives the empty filters a stable key", () => {
    expect(bookFiltersKey(EMPTY_BOOK_FILTERS)).toBe(bookFiltersKey({ ...EMPTY_BOOK_FILTERS }));
  });

  it("gives two equal selections the same key regardless of click order", () => {
    const a: BookFilters = {
      typeIds: ["type-2", "type-1"],
      ownership: ["owned"],
      progress: ["reading", "paused"],
      releaseYears: [1968, 1965],
    };
    const b: BookFilters = {
      typeIds: ["type-1", "type-2"],
      ownership: ["owned"],
      progress: ["paused", "reading"],
      releaseYears: [1965, 1968],
    };
    expect(bookFiltersKey(a)).toBe(bookFiltersKey(b));
  });

  it("gives different selections different keys", () => {
    expect(bookFiltersKey(EMPTY_BOOK_FILTERS)).not.toBe(
      bookFiltersKey({ ...EMPTY_BOOK_FILTERS, ownership: ["owned"] }),
    );
    expect(bookFiltersKey({ ...EMPTY_BOOK_FILTERS, releaseYears: [1965] })).not.toBe(
      bookFiltersKey({ ...EMPTY_BOOK_FILTERS, releaseYears: [1968] }),
    );
  });
});
