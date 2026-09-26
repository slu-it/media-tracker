import { describe, expect, it } from "vitest";
import { supergiantGames, teamCherry } from "../../../test/fixtures/games";
import { addDeveloper, isExistingDeveloper } from "./developerDraft";

describe("isExistingDeveloper", () => {
  it("distinguishes an existing developer from a pending one", () => {
    expect(isExistingDeveloper(teamCherry)).toBe(true);
    expect(isExistingDeveloper({ name: "New Studio" })).toBe(false);
  });
});

describe("addDeveloper", () => {
  it("appends a new existing developer", () => {
    expect(addDeveloper([], teamCherry)).toEqual([teamCherry]);
    expect(addDeveloper([teamCherry], supergiantGames)).toEqual([teamCherry, supergiantGames]);
  });

  it("ignores an existing developer already present by id", () => {
    expect(addDeveloper([teamCherry], teamCherry)).toEqual([teamCherry]);
  });

  it("appends a new pending developer, trimming the name", () => {
    expect(addDeveloper([], { name: "  New Studio  " })).toEqual([{ name: "New Studio" }]);
  });

  it("ignores a pending developer whose name matches an existing entry case-insensitively", () => {
    expect(addDeveloper([teamCherry], { name: "team cherry" })).toEqual([teamCherry]);
  });

  it("ignores a pending developer whose name matches another pending entry case-insensitively", () => {
    expect(addDeveloper([{ name: "New Studio" }], { name: "new studio" })).toEqual([{ name: "New Studio" }]);
  });

  it("replaces a pending entry with an existing developer of the same name", () => {
    expect(addDeveloper([{ name: "team cherry" }], teamCherry)).toEqual([teamCherry]);
  });

  it("leaves other entries untouched when replacing a pending one", () => {
    expect(addDeveloper([supergiantGames, { name: "team cherry" }], teamCherry)).toEqual([supergiantGames, teamCherry]);
  });
});
