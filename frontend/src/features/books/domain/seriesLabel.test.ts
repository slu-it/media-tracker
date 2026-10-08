import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { formatSeriesEntry, formatSeriesPosition } from "./seriesLabel";

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
});
