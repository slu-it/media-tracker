import { describe, expect, it } from "vitest";
import { supergiantGames, teamCherry } from "../../test/fixtures/games";
import { addEntry, isExistingEntry } from "./vocabularyDraft";

describe("isExistingEntry", () => {
  it("distinguishes an existing developer from a pending one", () => {
    expect(isExistingEntry(teamCherry)).toBe(true);
    expect(isExistingEntry({ name: "New Studio" })).toBe(false);
  });
});

describe("addEntry", () => {
  it("appends a new existing developer", () => {
    expect(addEntry([], teamCherry)).toEqual([teamCherry]);
    expect(addEntry([teamCherry], supergiantGames)).toEqual([teamCherry, supergiantGames]);
  });

  it("ignores an existing developer already present by id", () => {
    expect(addEntry([teamCherry], teamCherry)).toEqual([teamCherry]);
  });

  it("appends a new pending developer, trimming the name", () => {
    expect(addEntry([], { name: "  New Studio  " })).toEqual([{ name: "New Studio" }]);
  });

  it("ignores a pending developer whose name matches an existing entry case-insensitively", () => {
    expect(addEntry([teamCherry], { name: "team cherry" })).toEqual([teamCherry]);
  });

  it("ignores a pending developer whose name matches another pending entry case-insensitively", () => {
    expect(addEntry([{ name: "New Studio" }], { name: "new studio" })).toEqual([{ name: "New Studio" }]);
  });

  it("replaces a pending entry with an existing developer of the same name", () => {
    expect(addEntry([{ name: "team cherry" }], teamCherry)).toEqual([teamCherry]);
  });

  it("leaves other entries untouched when replacing a pending one", () => {
    expect(addEntry([supergiantGames, { name: "team cherry" }], teamCherry)).toEqual([supergiantGames, teamCherry]);
  });
});
