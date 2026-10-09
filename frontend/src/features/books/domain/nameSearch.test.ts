import { describe, expect, it } from "vitest";
import { duneSagaSummary, emptySeriesSummary, mistbornSummary, seriesSummaries } from "../../../test/fixtures/books";
import { filterByName } from "./nameSearch";

describe("filterByName", () => {
  it("keeps everything for a blank term", () => {
    expect(filterByName(seriesSummaries, "")).toBe(seriesSummaries);
    expect(filterByName(seriesSummaries, "   ")).toBe(seriesSummaries);
  });

  it("matches substrings case-insensitively", () => {
    expect(filterByName(seriesSummaries, "BORN")).toEqual([mistbornSummary]);
    expect(filterByName(seriesSummaries, "ne sa")).toEqual([duneSagaSummary]);
  });

  it("ignores accents in both directions", () => {
    expect(filterByName(seriesSummaries, "eowyn")).toEqual([emptySeriesSummary]);
    expect(filterByName(seriesSummaries, "ÉOWYN")).toEqual([emptySeriesSummary]);
    expect(filterByName([{ ...mistbornSummary, name: "Cafe" }], "café")).toHaveLength(1);
  });

  it("keeps the input order and returns nothing for no match", () => {
    expect(filterByName(seriesSummaries, "n")).toEqual(seriesSummaries);
    expect(filterByName(seriesSummaries, "zzz")).toEqual([]);
  });
});
