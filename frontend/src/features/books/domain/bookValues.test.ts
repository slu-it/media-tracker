import { describe, expect, it } from "vitest";
import {
  AUTHOR_SEARCH_LIMIT,
  BOOKS_PAGE_SIZE,
  BOOK_COVER_ASPECT_RATIO,
  NARRATOR_SEARCH_LIMIT,
  SERIES_SEARCH_LIMIT,
  formatSeriesPositionInput,
  parseSeriesPosition,
  validateSeriesPosition,
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

describe("validateSeriesPosition", () => {
  it.each(["", "  ", "0", "1", "2.5", "2,5", "0.25", "9999.99", "9999", " 3 ", "007"])("accepts %j", (raw) => {
    expect(validateSeriesPosition(raw)).toBeNull();
  });

  it.each(["abc", "-1", "10000", "1.234", "1.", ".5", "1,2,3", "1e3", "1 2", "+1"])("rejects %j", (raw) => {
    expect(validateSeriesPosition(raw)).toBe("invalidPosition");
  });
});

describe("parseSeriesPosition", () => {
  it("parses both decimal separators and yields null for empty or invalid text", () => {
    expect(parseSeriesPosition("2.5")).toBe(2.5);
    expect(parseSeriesPosition(" 2,5 ")).toBe(2.5);
    expect(parseSeriesPosition("0")).toBe(0);
    expect(parseSeriesPosition("")).toBeNull();
    expect(parseSeriesPosition("abc")).toBeNull();
  });

  it("formats a stored position back into input text", () => {
    expect(formatSeriesPositionInput(null, "en")).toBe("");
    expect(formatSeriesPositionInput(2.5, "en")).toBe("2.5");
    expect(formatSeriesPositionInput(2.5, "de")).toBe("2,5");
    expect(formatSeriesPositionInput(0, "en")).toBe("0");
    expect(formatSeriesPositionInput(1000, "de")).toBe("1000");
  });
});
