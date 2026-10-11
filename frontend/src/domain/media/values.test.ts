import { describe, expect, it } from "vitest";
import {
  COLORED_LABEL_MAX_LENGTH,
  formatSeriesPositionInput,
  parseSeriesPosition,
  validateSeriesPosition,
  normalizeHexColor,
  releaseYearOptions,
  validateColoredLabel,
  validateHexColor,
  validateCoverImageUrl,
  validateDescription,
  validateReleaseDate,
  validateReleaseYear,
  validateTitle,
  validateVocabularyName,
} from "./values";

describe("values", () => {
  it("validates the title like the backend", () => {
    expect(validateTitle("")).toBe("required");
    expect(validateTitle("   ")).toBe("required");
    expect(validateTitle("x".repeat(257))).toBe("tooLong");
    expect(validateTitle("x".repeat(256))).toBeNull();
    expect(validateTitle("Celeste")).toBeNull();
  });

  it("validates the release year as four digits", () => {
    expect(validateReleaseYear(null)).toBe("required");
    expect(validateReleaseYear(999)).toBe("invalidYear");
    expect(validateReleaseYear(10000)).toBe("invalidYear");
    expect(validateReleaseYear(2018.5)).toBe("invalidYear");
    expect(validateReleaseYear(2018)).toBeNull();
  });

  it("treats the description as optional but bounded", () => {
    expect(validateDescription("")).toBeNull();
    expect(validateDescription("   ")).toBeNull();
    expect(validateDescription("A great game.")).toBeNull();
    expect(validateDescription("x".repeat(10000))).toBeNull();
    expect(validateDescription("x".repeat(10001))).toBe("tooLong");
  });

  it("treats the cover URL as optional but strict when given", () => {
    expect(validateCoverImageUrl("")).toBeNull();
    expect(validateCoverImageUrl("   ")).toBeNull();
    expect(validateCoverImageUrl("https://img.example/c.png")).toBeNull();
    expect(validateCoverImageUrl("http://img.example/c.png")).toBeNull();
    expect(validateCoverImageUrl("/relative.png")).toBe("invalidUrl");
    expect(validateCoverImageUrl("ftp://img.example/c.png")).toBe("invalidUrl");
    expect(validateCoverImageUrl("not a url")).toBe("invalidUrl");
    expect(validateCoverImageUrl("https://img.example/" + "x".repeat(2048))).toBe("tooLong");
  });

  it("validates a vocabulary name like the backend", () => {
    expect(validateVocabularyName("")).toBe("required");
    expect(validateVocabularyName("   ")).toBe("required");
    expect(validateVocabularyName("  Team Cherry  ")).toBeNull();
    expect(validateVocabularyName("x".repeat(128))).toBeNull();
    expect(validateVocabularyName("x".repeat(129))).toBe("tooLong");
  });

  it("validates the release date like the backend", () => {
    expect(validateReleaseDate(null)).toBeNull();
    expect(validateReleaseDate("1000-01-01")).toBeNull();
    expect(validateReleaseDate("9999-12-31")).toBeNull();
    expect(validateReleaseDate("2024-02-29")).toBeNull(); // 2024 is a leap year
    expect(validateReleaseDate("1995-02-29")).toBe("invalidDate"); // 1995 is not a leap year
    expect(validateReleaseDate("1995-02-30")).toBe("invalidDate"); // no such day, regardless of leap years
    expect(validateReleaseDate("0999-01-01")).toBe("invalidDate"); // year below four digits
    expect(validateReleaseDate("10000-01-01")).toBe("invalidDate"); // malformed: five-digit year
    expect(validateReleaseDate("21-11-1995")).toBe("invalidDate"); // malformed: wrong field order
    expect(validateReleaseDate("not a date")).toBe("invalidDate");
  });

  it("generates the year options from the given year down to 1980", () => {
    const years = releaseYearOptions(undefined, 2026);
    expect(years[0]).toBe(2026);
    expect(years.at(-1)).toBe(1980);
    expect(years).toHaveLength(47);
  });

  it("honours a custom floor", () => {
    const years = releaseYearOptions(1450, 2026);
    expect(years[0]).toBe(2026);
    expect(years.at(-1)).toBe(1450);
    expect(years).toHaveLength(577);
  });

  it("normalises a hex color: trims, strips one leading # and uppercases", () => {
    expect(normalizeHexColor(" #0070d1 ")).toBe("0070D1");
    expect(normalizeHexColor("0070d1")).toBe("0070D1");
    expect(normalizeHexColor("##ab")).toBe("#AB");
  });

  it("accepts exactly six hex digits, with or without #, in any case", () => {
    expect(validateHexColor("0070D1")).toBeNull();
    expect(validateHexColor("#0070d1")).toBeNull();
    expect(validateHexColor("0070D")).toBe("invalidColor");
    expect(validateHexColor("0070D1F")).toBe("invalidColor");
    expect(validateHexColor("00G0D1")).toBe("invalidColor");
    expect(validateHexColor("")).toBe("invalidColor");
  });

  it("requires a colored label and caps it at 64 characters once trimmed", () => {
    expect(validateColoredLabel("  ")).toBe("required");
    expect(validateColoredLabel(" Kindle ")).toBeNull();
    expect(validateColoredLabel("x".repeat(COLORED_LABEL_MAX_LENGTH))).toBeNull();
    expect(validateColoredLabel("x".repeat(COLORED_LABEL_MAX_LENGTH + 1))).toBe("tooLong");
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
