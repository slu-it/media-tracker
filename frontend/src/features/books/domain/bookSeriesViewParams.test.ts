import { describe, expect, it } from "vitest";
import { bookSeriesViewParams, parseBookSeriesViewParams } from "./bookSeriesViewParams";

describe("book series view params", () => {
  it("parses an empty query to the default", () => {
    expect(parseBookSeriesViewParams(new URLSearchParams(""))).toEqual({ search: "" });
  });

  it("round-trips the search and trims it", () => {
    expect(parseBookSeriesViewParams(bookSeriesViewParams({ search: "mist" }))).toEqual({ search: "mist" });
    expect(parseBookSeriesViewParams(new URLSearchParams("search=%20born%20"))).toEqual({ search: "born" });
  });

  it("omits an empty search and ignores unknown params", () => {
    expect(bookSeriesViewParams({ search: "  " }).toString()).toBe("");
    expect(parseBookSeriesViewParams(new URLSearchParams("page=3&x=1"))).toEqual({ search: "" });
  });
});
