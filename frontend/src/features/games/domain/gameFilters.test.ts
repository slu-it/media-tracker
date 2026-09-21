import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, filtersKey, hasActiveFilters, type GameFilters } from "./gameFilters";

describe("gameFilters", () => {
  it("has no active filters by default", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it("is active as soon as any single field is non-empty", () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, platformIds: ["platform-1"] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, ownership: ["owned"] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, progress: ["playing"] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, releaseYears: [2018] })).toBe(true);
  });

  it("gives the empty filters a stable key", () => {
    expect(filtersKey(EMPTY_FILTERS)).toBe(filtersKey({ ...EMPTY_FILTERS }));
  });

  it("gives two equal selections the same key regardless of click order", () => {
    const a: GameFilters = {
      platformIds: ["platform-2", "platform-1"],
      ownership: ["owned"],
      progress: ["playing", "paused"],
      releaseYears: [2020, 2018],
    };
    const b: GameFilters = {
      platformIds: ["platform-1", "platform-2"],
      ownership: ["owned"],
      progress: ["paused", "playing"],
      releaseYears: [2018, 2020],
    };
    expect(filtersKey(a)).toBe(filtersKey(b));
  });

  it("gives different selections different keys", () => {
    expect(filtersKey(EMPTY_FILTERS)).not.toBe(filtersKey({ ...EMPTY_FILTERS, ownership: ["owned"] }));
    expect(filtersKey({ ...EMPTY_FILTERS, releaseYears: [2018] })).not.toBe(
      filtersKey({ ...EMPTY_FILTERS, releaseYears: [2020] }),
    );
  });
});
