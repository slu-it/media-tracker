import { describe, expect, it } from "vitest";
import { bookGroupViewParams, parseBookGroupViewParams } from "./bookGroupViewParams";

describe("book groups views (series, authors) params", () => {
  it("parses an empty query to the default", () => {
    expect(parseBookGroupViewParams(new URLSearchParams(""))).toEqual({ search: "" });
  });

  it("round-trips the search and trims it", () => {
    expect(parseBookGroupViewParams(bookGroupViewParams({ search: "mist" }))).toEqual({ search: "mist" });
    expect(parseBookGroupViewParams(new URLSearchParams("search=%20born%20"))).toEqual({ search: "born" });
  });

  it("omits an empty search and ignores unknown params", () => {
    expect(bookGroupViewParams({ search: "  " }).toString()).toBe("");
    expect(parseBookGroupViewParams(new URLSearchParams("page=3&x=1"))).toEqual({ search: "" });
  });
});
