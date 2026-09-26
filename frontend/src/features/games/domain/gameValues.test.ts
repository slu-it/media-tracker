import { describe, expect, it } from "vitest";
import {
  releaseYearOptions,
  validateCoverImageUrl,
  validateDescription,
  validateDeveloperName,
  validatePlatformIds,
  validateRating,
  validateReleaseDate,
  validateReleaseYear,
  validateTitle,
} from "./gameValues";

describe("gameValues", () => {
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

  it("requires at least one platform", () => {
    expect(validatePlatformIds([])).toBe("required");
    expect(validatePlatformIds(["platform-1"])).toBeNull();
    expect(validatePlatformIds(["platform-1", "platform-2"])).toBeNull();
  });

  it("treats the description as optional but bounded", () => {
    expect(validateDescription("")).toBeNull();
    expect(validateDescription("   ")).toBeNull();
    expect(validateDescription("A great game.")).toBeNull();
    expect(validateDescription("x".repeat(10000))).toBeNull();
    expect(validateDescription("x".repeat(10001))).toBe("tooLong");
  });

  it("treats the rating as optional but bounded and stepped", () => {
    expect(validateRating(null)).toBeNull();
    expect(validateRating(0.25)).toBeNull();
    expect(validateRating(5)).toBeNull();
    expect(validateRating(3.5)).toBeNull();
    expect(validateRating(0)).toBe("invalidRating");
    expect(validateRating(5.25)).toBe("invalidRating");
    expect(validateRating(0.1)).toBe("invalidRating");
    expect(validateRating(3.0000000001)).toBe("invalidRating");
    expect(validateRating(NaN)).toBe("invalidRating");
    expect(validateRating(Infinity)).toBe("invalidRating");
    expect(validateRating(-Infinity)).toBe("invalidRating");
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

  it("validates a developer name like the backend", () => {
    expect(validateDeveloperName("")).toBe("required");
    expect(validateDeveloperName("   ")).toBe("required");
    expect(validateDeveloperName("  Team Cherry  ")).toBeNull();
    expect(validateDeveloperName("x".repeat(128))).toBeNull();
    expect(validateDeveloperName("x".repeat(129))).toBe("tooLong");
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
    const years = releaseYearOptions(2026);
    expect(years[0]).toBe(2026);
    expect(years.at(-1)).toBe(1980);
    expect(years).toHaveLength(47);
  });
});
