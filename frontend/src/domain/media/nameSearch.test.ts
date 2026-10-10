import { describe, expect, it } from "vitest";
import { filterByName } from "./nameSearch";

const duneSagaSummary = { id: "1", name: "Dune Saga", itemCount: 1 };
const emptySeriesSummary = { id: "3", name: "Éowyn Chronicles", itemCount: 0 };
const mistbornSummary = { id: "2", name: "Mistborn", itemCount: 3 };
const seriesSummaries = [duneSagaSummary, emptySeriesSummary, mistbornSummary];

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
