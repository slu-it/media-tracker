import { describe, expect, it } from "vitest";
import { COLOR_PALETTE, PALETTE_ENTRIES, firstUnusedColor } from "./colorPalette";
import { validateHexColor } from "./values";

describe("colorPalette", () => {
  it("offers 16 distinct valid colors", () => {
    expect(COLOR_PALETTE).toHaveLength(16);
    expect(new Set(COLOR_PALETTE).size).toBe(16);
    expect(COLOR_PALETTE.every((color) => validateHexColor(color) === null)).toBe(true);
  });

  it("names every color with a distinct i18n key", () => {
    expect(new Set(PALETTE_ENTRIES.map((entry) => entry.nameKey)).size).toBe(16);
    expect(PALETTE_ENTRIES.map((entry) => entry.hex)).toEqual(COLOR_PALETTE);
  });

  it("picks the first color not in use, case-insensitively", () => {
    expect(firstUnusedColor([])).toBe(COLOR_PALETTE[0]);
    expect(firstUnusedColor([COLOR_PALETTE[0], COLOR_PALETTE[1].toLowerCase()])).toBe(COLOR_PALETTE[2]);
  });

  it("falls back to the first color when every one is in use", () => {
    expect(firstUnusedColor(COLOR_PALETTE)).toBe(COLOR_PALETTE[0]);
  });
});
