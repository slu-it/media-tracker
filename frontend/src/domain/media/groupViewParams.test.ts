import { describe, expect, it } from "vitest";
import { groupViewParams, parseGroupViewParams } from "./groupViewParams";

describe("group views params", () => {
  it("parses an empty query to the default", () => {
    expect(parseGroupViewParams(new URLSearchParams(""))).toEqual({ search: "" });
  });

  it("round-trips the search and trims it", () => {
    expect(parseGroupViewParams(groupViewParams({ search: "mist" }))).toEqual({ search: "mist" });
    expect(parseGroupViewParams(new URLSearchParams("search=%20born%20"))).toEqual({ search: "born" });
  });

  it("omits an empty search and ignores unknown params", () => {
    expect(groupViewParams({ search: "  " }).toString()).toBe("");
    expect(parseGroupViewParams(new URLSearchParams("page=3&x=1"))).toEqual({ search: "" });
  });
});
