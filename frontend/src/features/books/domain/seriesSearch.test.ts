import { describe, expect, it } from "vitest";
import { duneSagaSummary, emptySeriesSummary, mistbornSummary, seriesSummaries } from "../../../test/fixtures/books";
import { filterSeriesByName } from "./seriesSearch";

describe("filterSeriesByName", () => {
  it("keeps everything for a blank term", () => {
    expect(filterSeriesByName(seriesSummaries, "")).toBe(seriesSummaries);
    expect(filterSeriesByName(seriesSummaries, "   ")).toBe(seriesSummaries);
  });

  it("matches substrings case-insensitively", () => {
    expect(filterSeriesByName(seriesSummaries, "BORN")).toEqual([mistbornSummary]);
    expect(filterSeriesByName(seriesSummaries, "ne sa")).toEqual([duneSagaSummary]);
  });

  it("ignores accents in both directions", () => {
    expect(filterSeriesByName(seriesSummaries, "eowyn")).toEqual([emptySeriesSummary]);
    expect(filterSeriesByName(seriesSummaries, "ÉOWYN")).toEqual([emptySeriesSummary]);
    expect(filterSeriesByName([{ ...mistbornSummary, name: "Cafe" }], "café")).toHaveLength(1);
  });

  it("keeps the input order and returns nothing for no match", () => {
    expect(filterSeriesByName(seriesSummaries, "n")).toEqual(seriesSummaries);
    expect(filterSeriesByName(seriesSummaries, "zzz")).toEqual([]);
  });
});
