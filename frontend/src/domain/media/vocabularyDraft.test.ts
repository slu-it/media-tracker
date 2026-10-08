import { describe, expect, it, vi } from "vitest";
import { supergiantGames, teamCherry } from "../../test/fixtures/games";
import { addEntry, isExistingEntry, resolveVocabularyEntries, resolveVocabularyIds } from "./vocabularyDraft";

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

describe("resolveVocabularyEntries", () => {
  it("keeps the order and length of the drafts, creating each pending name once", async () => {
    const create = vi.fn((name: string) => Promise.resolve({ id: "new-1", name }));
    const entries = await resolveVocabularyEntries(
      [{ name: "Fresh" }, teamCherry, { name: " fresh " }, teamCherry],
      create,
    );
    expect(entries.map((entry) => entry.id)).toEqual(["new-1", teamCherry.id, "new-1", teamCherry.id]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith("Fresh");
  });

  it("stops creating after a failure", async () => {
    const create = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(resolveVocabularyEntries([{ name: "A" }, { name: "B" }], create)).rejects.toThrow("boom");
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("resolveVocabularyIds", () => {
  it("dedupes ids", async () => {
    const create = vi.fn((name: string) => Promise.resolve({ id: teamCherry.id, name }));
    expect(await resolveVocabularyIds([teamCherry, { name: "Team Cherry" }], create)).toEqual([teamCherry.id]);
  });
});
