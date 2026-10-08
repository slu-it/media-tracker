import { describe, expect, it } from "vitest";
import { SEARCH_MAX_LENGTH } from "./values";
import { MAX_FILTER_VALUES, parsePage, parseSearch, parseUuids, parseYears } from "./viewParams";

const query = (value: string) => new URLSearchParams(value);

describe("view param codecs", () => {
  it("drops years outside the release-year range", () => {
    expect(parseYears(query("year=999&year=10000&year=12&year=0&year=1000&year=9999"))).toEqual([1000, 9999]);
  });

  it("caps repeatable filters at MAX_FILTER_VALUES", () => {
    const years = Array.from({ length: MAX_FILTER_VALUES + 10 }, (_, i) => `year=${2000 + i}`).join("&");
    expect(parseYears(query(years))).toHaveLength(MAX_FILTER_VALUES);
    const ids = Array.from(
      { length: MAX_FILTER_VALUES + 10 },
      (_, i) => `platform=00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    ).join("&");
    expect(parseUuids(query(ids), "platform")).toHaveLength(MAX_FILTER_VALUES);
    // Positive control: exactly the limit passes unchanged.
    expect(parseYears(query(years.split("&").slice(0, MAX_FILTER_VALUES).join("&")))).toHaveLength(MAX_FILTER_VALUES);
  });

  it("drops a search longer than SEARCH_MAX_LENGTH", () => {
    expect(parseSearch(query(`search=${"x".repeat(SEARCH_MAX_LENGTH)}`))).toBe("x".repeat(SEARCH_MAX_LENGTH));
    expect(parseSearch(query(`search=${"x".repeat(SEARCH_MAX_LENGTH + 1)}`))).toBe("");
  });

  it("drops a page above 2^31-1", () => {
    expect(parsePage(query("page=2147483647"))).toBe(2147483647);
    expect(parsePage(query("page=2147483648"))).toBe(1);
  });
});
