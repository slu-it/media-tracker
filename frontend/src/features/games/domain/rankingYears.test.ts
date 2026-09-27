import { describe, expect, it } from "vitest";
import { rankingYears, resolveRankingYear } from "./rankingYears";

describe("rankingYears", () => {
  it("returns just the current year when nothing else is in use", () => {
    expect(rankingYears([], 2026)).toEqual([2026]);
  });

  it("includes every past-or-current year in use", () => {
    expect(rankingYears([2018, 2020], 2026)).toEqual([2026, 2020, 2018]);
  });

  it("adds the current year even when it has no rated game yet", () => {
    expect(rankingYears([2018], 2026)).toEqual([2026, 2018]);
  });

  it("drops years after the current year", () => {
    expect(rankingYears([2018, 2030], 2026)).toEqual([2026, 2018]);
  });

  it("deduplicates a release year equal to the current year", () => {
    expect(rankingYears([2026, 2018], 2026)).toEqual([2026, 2018]);
  });

  it("sorts descending regardless of input order", () => {
    expect(rankingYears([2018, 2022, 2020], 2026)).toEqual([2026, 2022, 2020, 2018]);
  });
});

describe("resolveRankingYear", () => {
  it("keeps the selection when it is still offered", () => {
    expect(resolveRankingYear([2026, 2020, 2018], 2020, 2026)).toBe(2020);
  });

  it("falls back to the current year when that was the previous selection", () => {
    expect(resolveRankingYear([2020, 2018], 2026, 2026)).toBe(2026);
  });

  it("falls back to the nearest remaining year otherwise", () => {
    expect(resolveRankingYear([2026, 2022, 2015], 2020, 2026)).toBe(2022);
  });

  it("breaks a distance tie towards the newer year", () => {
    expect(resolveRankingYear([2026, 2018, 2022], 2020, 2026)).toBe(2022);
  });
});
