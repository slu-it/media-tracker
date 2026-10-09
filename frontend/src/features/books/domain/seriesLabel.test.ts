import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { formatSeriesEntry, formatSeriesPosition, primarySeries } from "./seriesLabel";

const t = ((key: string, options: { name: string; position: string }) =>
  `${key}:${options.name}:${options.position}`) as unknown as TFunction;

describe("seriesLabel", () => {
  it("formats positions in the language's decimal format without grouping", () => {
    expect(formatSeriesPosition(2.5, "en")).toBe("2.5");
    expect(formatSeriesPosition(2.5, "de")).toBe("2,5");
    expect(formatSeriesPosition(1000, "de")).toBe("1000");
    expect(formatSeriesPosition(1000, "en")).toBe("1000");
  });

  it("labels an entry with its position, or just the name without one", () => {
    expect(formatSeriesEntry({ id: "s", name: "Mistborn", position: 1000 }, t, "de")).toBe(
      "books.fields.seriesEntry:Mistborn:1000",
    );
    expect(formatSeriesEntry({ id: "s", name: "Mistborn", position: null }, t, "de")).toBe("Mistborn");
  });

  describe("primarySeries", () => {
    const entry = (id: string, name: string, position: number | null) => ({ id, name, position });

    it("returns undefined for an empty list", () => {
      expect(primarySeries([])).toBeUndefined();
    });

    it("returns a single entry", () => {
      const only = entry("a", "Mistborn", null);
      expect(primarySeries([only])).toBe(only);
    });

    it("prefers the lowest number whatever the input order", () => {
      const mistborn = entry("m", "Mistborn Saga", 4);
      const wax = entry("w", "Wax and Wayne", 1);
      expect(primarySeries([mistborn, wax])).toBe(wax);
      expect(primarySeries([wax, mistborn])).toBe(wax);
    });

    it("ranks a number before no position", () => {
      const cosmere = entry("c", "A Cosmere", null);
      const stormlight = entry("s", "Stormlight", 1);
      expect(primarySeries([cosmere, stormlight])).toBe(stormlight);
      expect(primarySeries([stormlight, cosmere])).toBe(stormlight);
    });

    it("goes by name when no entry has a position", () => {
      const b = entry("1", "Beta", null);
      const a = entry("2", "Alpha", null);
      expect(primarySeries([b, a])).toBe(a);
    });

    it("goes by name for equal positions", () => {
      const b = entry("1", "Beta", 2);
      const a = entry("2", "Alpha", 2);
      expect(primarySeries([b, a])).toBe(a);
    });

    it("compares fractional positions numerically", () => {
      const ten = entry("t", "Ten", 10);
      const nineAndHalf = entry("n", "Nine", 9.5);
      expect(primarySeries([ten, nineAndHalf])).toBe(nineAndHalf);
      expect(primarySeries([nineAndHalf, ten])).toBe(nineAndHalf);

      const two = entry("2", "Zeta", 2);
      const twoAndHalf = entry("h", "Alpha", 2.5);
      expect(primarySeries([two, twoAndHalf])).toBe(two);
      expect(primarySeries([twoAndHalf, two])).toBe(two);
    });

    it("goes by id when name and position are equal", () => {
      const first = entry("a", "Mistborn", 1);
      const second = entry("b", "Mistborn", 1);
      expect(primarySeries([first, second])).toBe(first);
      expect(primarySeries([second, first])).toBe(first);
    });

    it("does not mutate the input", () => {
      const list = [entry("m", "Mistborn Saga", 4), entry("w", "Wax and Wayne", 1)];
      const copy = [...list];
      primarySeries(list);
      expect(list).toEqual(copy);
    });
  });
});
