import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, MAX_FILTER_VALUES } from "./gameFilters";
import { SEARCH_MAX_LENGTH } from "./gameValues";
import {
  overviewParams,
  parseOverviewParams,
  parseRankingParams,
  parseWatchlistParams,
  rankingParams,
  watchlistParams,
} from "./gameViewParams";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

const parse = (query: string) => parseOverviewParams(new URLSearchParams(query));

describe("overview params", () => {
  it("parses an empty query to the defaults", () => {
    expect(parse("")).toEqual({ search: "", page: 1, filters: EMPTY_FILTERS });
  });

  it("round-trips a full state", () => {
    const state = {
      search: "zelda",
      page: 3,
      filters: {
        platformIds: [A, B],
        ownership: ["owned" as const],
        progress: ["finished" as const, "playing" as const],
        releaseYears: [2017, 2020],
      },
    };
    expect(parseOverviewParams(overviewParams(state))).toEqual({
      ...state,
      filters: { ...state.filters, progress: ["finished", "playing"] },
    });
  });

  it("omits defaults and empty values", () => {
    expect(overviewParams({ search: "  ", page: 1, filters: EMPTY_FILTERS }).toString()).toBe("");
  });

  it("serializes in a deterministic key and value order", () => {
    const a = overviewParams({
      search: " zelda ",
      page: 2,
      filters: {
        platformIds: [B, A, B],
        ownership: ["owned", "watchlist"],
        progress: [],
        releaseYears: [2020, 2017],
      },
    });
    expect(a.toString()).toBe(
      `search=zelda&platform=${A}&platform=${B}&ownership=owned&ownership=watchlist&year=2017&year=2020&page=2`,
    );
    expect(parseOverviewParams(a)).toEqual(
      parse(`page=2&year=2020&year=2017&ownership=watchlist&ownership=owned&platform=${B}&platform=${A}&search=zelda`),
    );
  });

  it("drops invalid values silently", () => {
    expect(parse("page=-3&ownership=foo&progress=bar&year=abc&year=20.5&year=-1&platform=")).toEqual({
      search: "",
      page: 1,
      filters: EMPTY_FILTERS,
    });
    expect(parse("page=0").page).toBe(1);
    expect(parse("page=1e3").page).toBe(1);
    expect(parse("page=99999999999999999999").page).toBe(1);
    expect(parse("ownership=owned&ownership=foo").filters.ownership).toEqual(["owned"]);
    expect(parse("year=2017&year=2017&year=x").filters.releaseYears).toEqual([2017]);
  });

  it("lowercases platform ids and de-duplicates them case-insensitively", () => {
    expect(parse(`platform=${A.toUpperCase()}&platform=${A}`).filters.platformIds).toEqual([A]);
  });

  it("drops platform ids that are not UUIDs", () => {
    expect(parse(`platform=whatever%20id&platform=${B}&platform=${A}`).filters.platformIds).toEqual([A, B]);
  });

  it("drops years outside the release-year range", () => {
    expect(parse("year=999&year=10000&year=12&year=0&year=1000&year=9999").filters.releaseYears).toEqual([1000, 9999]);
  });

  it("caps repeatable filters at MAX_FILTER_VALUES", () => {
    const years = Array.from({ length: MAX_FILTER_VALUES + 10 }, (_, i) => `year=${2000 + i}`).join("&");
    expect(parse(years).filters.releaseYears).toHaveLength(MAX_FILTER_VALUES);
    const platforms = Array.from(
      { length: MAX_FILTER_VALUES + 10 },
      (_, i) => `platform=00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    ).join("&");
    expect(parse(platforms).filters.platformIds).toHaveLength(MAX_FILTER_VALUES);
    // Positive control: exactly the limit passes unchanged.
    expect(parse(years.split("&").slice(0, MAX_FILTER_VALUES).join("&")).filters.releaseYears).toHaveLength(
      MAX_FILTER_VALUES,
    );
  });

  it("drops a search longer than SEARCH_MAX_LENGTH", () => {
    expect(parse(`search=${"x".repeat(SEARCH_MAX_LENGTH)}`).search).toBe("x".repeat(SEARCH_MAX_LENGTH));
    expect(parse(`search=${"x".repeat(SEARCH_MAX_LENGTH + 1)}`).search).toBe("");
  });

  it("drops a page above 2^31-1", () => {
    expect(parse("page=2147483647").page).toBe(2147483647);
    expect(parse("page=2147483648").page).toBe(1);
  });
});

describe("watchlist params", () => {
  it("defaults the sort and omits it when serializing", () => {
    expect(parseWatchlistParams(new URLSearchParams())).toEqual({
      search: "",
      platformIds: [],
      sort: "release_asc",
      page: 1,
    });
    expect(watchlistParams({ search: "", platformIds: [], sort: "release_asc", page: 1 }).toString()).toBe("");
  });

  it("round-trips release_desc, platforms and page in a fixed order", () => {
    const state = { search: "x", platformIds: [A, B], sort: "release_desc" as const, page: 2 };
    const params = watchlistParams(state);
    expect(params.toString()).toBe(`search=x&platform=${A}&platform=${B}&sort=release_desc&page=2`);
    expect(parseWatchlistParams(params)).toEqual(state);
  });

  it("drops an unknown sort and other junk", () => {
    expect(parseWatchlistParams(new URLSearchParams("sort=rating_desc&page=x")).sort).toBe("release_asc");
    expect(parseWatchlistParams(new URLSearchParams("sort=rating_desc&page=x")).page).toBe(1);
  });
});

describe("ranking params", () => {
  it("round-trips a single year", () => {
    expect(rankingParams({ year: 2019 }).toString()).toBe("year=2019");
    expect(parseRankingParams(rankingParams({ year: 2019 }))).toEqual({ year: 2019 });
  });

  it("treats a missing or invalid year as null and omits null", () => {
    expect(parseRankingParams(new URLSearchParams())).toEqual({ year: null });
    expect(parseRankingParams(new URLSearchParams("year=abc"))).toEqual({ year: null });
    expect(parseRankingParams(new URLSearchParams("year=-5"))).toEqual({ year: null });
    expect(rankingParams({ year: null }).toString()).toBe("");
  });

  it("treats a year outside the release-year range as null", () => {
    expect(parseRankingParams(new URLSearchParams("year=12"))).toEqual({ year: null });
    expect(parseRankingParams(new URLSearchParams("year=10000"))).toEqual({ year: null });
    expect(parseRankingParams(new URLSearchParams("year=1000"))).toEqual({ year: 1000 });
  });
});
