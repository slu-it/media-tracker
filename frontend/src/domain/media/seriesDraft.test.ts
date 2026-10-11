import { describe, expect, it, vi } from "vitest";
import {
  existingSeriesLinks,
  linksOfEntries,
  resolveSeriesLinks,
  sameSeriesLinks,
  seriesDraftsFromEntries,
} from "./seriesDraft";

const existing = { id: "series-1", name: "Mistborn" };

describe("seriesDraft", () => {
  it("turns stored entries into drafts with the position in the language's format", () => {
    expect(seriesDraftsFromEntries([{ ...existing, position: 2.5 }], "de")).toEqual([
      { entry: existing, position: "2,5" },
    ]);
    expect(seriesDraftsFromEntries([{ ...existing, position: null }], "en")[0].position).toBe("");
  });

  it("builds links for the existing entries only", () => {
    expect(
      existingSeriesLinks([
        { entry: existing, position: "1,5" },
        { entry: { name: "Pending" }, position: "2" },
      ]),
    ).toEqual([{ seriesId: existing.id, position: 1.5 }]);
  });

  it("compares sets of (series, position) pairs regardless of order", () => {
    const a = [
      { seriesId: "a", position: 1 },
      { seriesId: "b", position: null },
    ];
    expect(sameSeriesLinks(a, [...a].reverse())).toBe(true);
    expect(sameSeriesLinks(a, [{ seriesId: "a", position: 1 }])).toBe(false);
    expect(sameSeriesLinks(a, [a[0], { seriesId: "b", position: 2 }])).toBe(false);
    expect(linksOfEntries([{ id: "a", position: 1 }])).toEqual([{ seriesId: "a", position: 1 }]);
  });

  it("resolves drafts to links, creating each pending name once", async () => {
    const create = vi.fn(() => Promise.resolve({ id: "series-9", name: "New" }));
    const links = await resolveSeriesLinks(
      [
        { entry: { name: "New" }, position: "2,5" },
        { entry: existing, position: "" },
        { entry: { name: " new " }, position: "7" },
      ],
      create,
    );
    expect(links).toEqual([
      { seriesId: "series-9", position: 2.5 },
      { seriesId: existing.id, position: null },
    ]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("prefers the first duplicate link that has a position", async () => {
    const links = await resolveSeriesLinks(
      [
        { entry: existing, position: "" },
        { entry: existing, position: "3" },
        { entry: existing, position: "4" },
      ],
      vi.fn(),
    );
    expect(links).toEqual([{ seriesId: existing.id, position: 3 }]);
  });
});
