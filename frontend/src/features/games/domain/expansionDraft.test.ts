import { describe, expect, it } from "vitest";
import type { ExpansionResponse } from "../../../types/api";
import { hadesExpansion1 } from "../../../test/fixtures/games";
import {
  draftFromExpansion,
  emptyExpansionDraft,
  isDraftDirty,
  isDraftValid,
  toCreateRequest,
  toUpdateRequest,
} from "./expansionDraft";

const expansion: ExpansionResponse = { ...hadesExpansion1 };

describe("expansionDraft", () => {
  it("round-trips an expansion and knows when nothing changed", () => {
    const draft = draftFromExpansion(expansion);
    expect(isDraftValid(draft)).toBe(true);
    expect(isDraftDirty(expansion, draft)).toBe(false);
    expect(toUpdateRequest(expansion, draft)).toEqual({});
  });

  it("is invalid without a title", () => {
    const empty = emptyExpansionDraft();
    expect(isDraftValid(empty)).toBe(false);
    expect(() => toCreateRequest(empty)).toThrow();
  });

  it("defaults ownership and progress on an empty draft", () => {
    const empty = emptyExpansionDraft();
    expect(empty.title).toBe("");
    expect(empty.ownership).toBe("watchlist");
    expect(empty.progress).toBe("not_started");
  });

  it("builds a create request with a trimmed title", () => {
    const draft = { title: " Soundtrack ", ownership: "owned" as const, progress: "finished" as const };
    expect(toCreateRequest(draft)).toEqual({
      title: "Soundtrack",
      ownership: "owned",
      progress: "finished",
    });
  });

  it("sends only the changed fields", () => {
    const draft = { ...draftFromExpansion(expansion), progress: "finished" as const };
    expect(isDraftDirty(expansion, draft)).toBe(true);
    expect(toUpdateRequest(expansion, draft)).toEqual({ progress: "finished" });
  });

  it("reports a changed title and ownership", () => {
    const draft = { ...draftFromExpansion(expansion), title: "  Renamed  ", ownership: "watchlist" as const };
    expect(toUpdateRequest(expansion, draft)).toEqual({ title: "Renamed", ownership: "watchlist" });
  });
});
