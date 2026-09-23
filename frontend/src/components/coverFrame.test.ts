import { describe, expect, it } from "vitest";
import { coverHeight } from "./coverFrame";

describe("coverHeight", () => {
  it("derives the height for the detail dialog cover", () => {
    expect(coverHeight(240)).toBe(338);
  });

  it("derives the height for the card cover", () => {
    expect(coverHeight(168)).toBe(237);
  });

  it("derives the height for the cover picker thumbnail", () => {
    expect(coverHeight(120)).toBe(169);
  });
});
