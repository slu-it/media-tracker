import { describe, expect, it } from "vitest";
import {
  AUTHOR_SEARCH_LIMIT,
  BOOKS_PAGE_SIZE,
  BOOK_COVER_ASPECT_RATIO,
  NARRATOR_SEARCH_LIMIT,
  SERIES_SEARCH_LIMIT,
} from "./bookValues";

describe("bookValues", () => {
  it("mirrors the agreed constants", () => {
    expect(BOOKS_PAGE_SIZE).toBe(36);
    expect(BOOK_COVER_ASPECT_RATIO).toBeCloseTo(2 / 3);
    expect(AUTHOR_SEARCH_LIMIT).toBeGreaterThan(0);
    expect(NARRATOR_SEARCH_LIMIT).toBeGreaterThan(0);
    expect(SERIES_SEARCH_LIMIT).toBeGreaterThan(0);
  });
});
