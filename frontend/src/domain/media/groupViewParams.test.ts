import { describe, expect, it } from "vitest";
import { groupViewParams, parseGroupViewParams } from "./groupViewParams";

describe("group views params", () => {
  it("parses an empty query to the default", () => {
    expect(parseGroupViewParams(new URLSearchParams(""))).toEqual({ search: "", sort: "name" });
  });

  it("round-trips the search and trims it", () => {
    expect(parseGroupViewParams(groupViewParams({ search: "mist", sort: "name" }))).toEqual({
      search: "mist",
      sort: "name",
    });
    expect(parseGroupViewParams(new URLSearchParams("search=%20born%20"))).toEqual({ search: "born", sort: "name" });
  });

  it("omits an empty search and ignores unknown params", () => {
    expect(groupViewParams({ search: "  ", sort: "name" }).toString()).toBe("");
    expect(parseGroupViewParams(new URLSearchParams("page=3&x=1"))).toEqual({ search: "", sort: "name" });
  });

  it("round-trips sort=volume", () => {
    const params = groupViewParams({ search: "", sort: "volume" });
    expect(params.toString()).toBe("sort=volume");
    expect(parseGroupViewParams(params)).toEqual({ search: "", sort: "volume" });
  });

  it("drops the default and invalid sort values", () => {
    expect(groupViewParams({ search: "", sort: "name" }).toString()).toBe("");
    expect(parseGroupViewParams(new URLSearchParams("sort=bogus"))).toEqual({ search: "", sort: "name" });
    expect(parseGroupViewParams(new URLSearchParams("sort=name"))).toEqual({ search: "", sort: "name" });
  });

  it("combines search and sort", () => {
    const params = groupViewParams({ search: "mist", sort: "volume" });
    expect(params.toString()).toBe("search=mist&sort=volume");
    expect(parseGroupViewParams(params)).toEqual({ search: "mist", sort: "volume" });
  });
});
