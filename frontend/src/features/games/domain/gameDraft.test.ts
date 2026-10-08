import { describe, expect, it } from "vitest";
import type { GameResponse } from "../../../types/api";
import { celeste, nintendo, pc, playstation, supergiantGames, teamCherry } from "../../../test/fixtures/games";
import { withReleaseDate } from "../../../domain/media/draft";
import {
  draftFromGame,
  emptyGameDraft,
  isDraftDirty,
  isDraftValid,
  toCreateRequest,
  toUpdateRequest,
} from "./gameDraft";

const game: GameResponse = {
  ...celeste,
  description: "A tough platformer.",
  rating: 4.5,
  ownership: "owned",
  progress: "playing",
  hidden: false,
};

describe("gameDraft", () => {
  it("round-trips a game and knows when nothing changed", () => {
    const draft = draftFromGame(game);
    expect(isDraftValid(draft)).toBe(true);
    expect(isDraftDirty(game, draft)).toBe(false);
    expect(toUpdateRequest(game, draft, [])).toEqual({});
  });

  it("does not report a change when platform ids are the same set in a different order", () => {
    const multi = { ...game, platforms: [nintendo, pc] };
    const draft = { ...draftFromGame(multi), platformIds: [pc.id, nintendo.id] };
    expect(toUpdateRequest(multi, draft, [])).toEqual({});
  });

  it("sends only the changed fields and null to clear the cover and description", () => {
    const draft = { ...draftFromGame(game), title: "  Celeste (Switch) ", coverImageUrl: "", description: "  " };
    expect(isDraftDirty(game, draft)).toBe(true);
    expect(toUpdateRequest(game, draft, [])).toEqual({
      title: "Celeste (Switch)",
      coverImageUrl: null,
      description: null,
    });

    const recover = { ...draftFromGame({ ...game, coverImageUrl: null }), coverImageUrl: "https://img.example/n.png" };
    expect(toUpdateRequest({ ...game, coverImageUrl: null }, recover, [])).toEqual({
      coverImageUrl: "https://img.example/n.png",
    });
  });

  it("reports a changed platform selection and rating", () => {
    const draft = { ...draftFromGame(game), platformIds: [playstation.id], rating: null };
    expect(toUpdateRequest(game, draft, [])).toEqual({ platformIds: [playstation.id], rating: null });
  });

  it("builds a create request with a trimmed title and null for no cover/description", () => {
    const empty = emptyGameDraft();
    expect(isDraftValid(empty)).toBe(false);
    expect(() => toCreateRequest(empty, [])).toThrow();

    const draft = {
      title: " Hades ",
      releaseYear: 2020,
      releaseDate: null,
      platformIds: [pc.id],
      description: " ",
      rating: null,
      coverImageUrl: " ",
      ownership: "watchlist" as const,
      progress: "not_started" as const,
      hidden: false,
      developers: [],
    };
    expect(toCreateRequest(draft, [])).toEqual({
      title: "Hades",
      releaseYear: 2020,
      platformIds: [pc.id],
      description: null,
      rating: null,
      coverImageUrl: null,
      ownership: "watchlist",
      progress: "not_started",
      hidden: false,
      releaseDate: null,
    });
  });

  it("defaults ownership, progress and hidden on an empty draft", () => {
    const empty = emptyGameDraft();
    expect(empty.ownership).toBe("watchlist");
    expect(empty.progress).toBe("not_started");
    expect(empty.hidden).toBe(false);
  });

  it("round-trips ownership, progress and hidden from a game", () => {
    const draft = draftFromGame(game);
    expect(draft.ownership).toBe("owned");
    expect(draft.progress).toBe("playing");
    expect(draft.hidden).toBe(false);
    expect(isDraftDirty(game, draft)).toBe(false);
  });

  it("sends only ownership, progress and hidden that changed", () => {
    const draft = { ...draftFromGame(game), progress: "completed" as const, hidden: true };
    expect(isDraftDirty(game, draft)).toBe(true);
    expect(toUpdateRequest(game, draft, [])).toEqual({ progress: "completed", hidden: true });
  });

  it("sends the changed release date and null to clear it", () => {
    const dated = { ...game, releaseDate: "2018-01-25" };
    const draft = withReleaseDate(draftFromGame(dated), "2020-03-01");
    expect(toUpdateRequest(dated, draft, [])).toEqual({ releaseDate: "2020-03-01", releaseYear: 2020 });

    const cleared = withReleaseDate(draftFromGame(dated), null);
    expect(toUpdateRequest(dated, cleared, [])).toEqual({ releaseDate: null });
  });
});

describe("gameDraft developers", () => {
  it("carries a game's developers into the draft", () => {
    const withDevelopers = { ...game, developers: [teamCherry, supergiantGames] };
    const draft = draftFromGame(withDevelopers);
    expect(draft.developers).toEqual([teamCherry, supergiantGames]);
  });

  it("includes developerIds in a create request only when given", () => {
    const draft = { ...draftFromGame(game), developers: [] };
    expect(toCreateRequest(draft, [])).not.toHaveProperty("developerIds");
    expect(toCreateRequest(draft, [teamCherry.id, supergiantGames.id])).toMatchObject({
      developerIds: [teamCherry.id, supergiantGames.id],
    });
  });

  it("sends developerIds only when the resolved set differs from the game's, order-insensitive", () => {
    const withDevelopers = { ...game, developers: [teamCherry, supergiantGames] };
    const draft = draftFromGame(withDevelopers);
    expect(toUpdateRequest(withDevelopers, draft, [supergiantGames.id, teamCherry.id])).toEqual({});
    expect(toUpdateRequest(withDevelopers, draft, [teamCherry.id])).toEqual({ developerIds: [teamCherry.id] });
  });

  it("is dirty when a pending developer is present, even before it resolves to an id", () => {
    const draft = { ...draftFromGame(game), developers: [{ name: "New Studio" }] };
    expect(isDraftDirty(game, draft)).toBe(true);
  });

  it("is dirty when the existing developer selection differs from the game's", () => {
    const withDevelopers = { ...game, developers: [teamCherry] };
    const draft = { ...draftFromGame(withDevelopers), developers: [supergiantGames] };
    expect(isDraftDirty(withDevelopers, draft)).toBe(true);
  });

  it("is not dirty when the existing developer selection is unchanged", () => {
    const withDevelopers = { ...game, developers: [teamCherry, supergiantGames] };
    const draft = draftFromGame(withDevelopers);
    expect(isDraftDirty(withDevelopers, draft)).toBe(false);
  });
});
