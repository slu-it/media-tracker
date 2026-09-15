import { describe, expect, it } from "vitest";
import type { GamePlatformResponse, GameResponse } from "../../../types/api";
import {
  draftFromGame,
  emptyGameDraft,
  isDraftDirty,
  isDraftValid,
  toCreateRequest,
  toUpdateRequest,
} from "./gameDraft";

const nintendo: GamePlatformResponse = { id: "platform-nintendo", label: "Nintendo", associatedColor: "E60012" };
const pc: GamePlatformResponse = { id: "platform-pc", label: "PC", associatedColor: "757575" };
const playstation: GamePlatformResponse = {
  id: "platform-playstation",
  label: "PlayStation",
  associatedColor: "0070D1",
};

const game: GameResponse = {
  id: "9a1d6c1e-0f2a-4b7c-8d3e-5f6a7b8c9d0e",
  title: "Celeste",
  releaseYear: 2018,
  description: "A tough platformer.",
  rating: 4.5,
  platforms: [nintendo],
  coverImageUrl: "https://img.example/c.png",
};

describe("gameDraft", () => {
  it("round-trips a game and knows when nothing changed", () => {
    const draft = draftFromGame(game);
    expect(isDraftValid(draft)).toBe(true);
    expect(isDraftDirty(game, draft)).toBe(false);
    expect(toUpdateRequest(game, draft)).toEqual({});
  });

  it("does not report a change when platform ids are the same set in a different order", () => {
    const multi = { ...game, platforms: [nintendo, pc] };
    const draft = { ...draftFromGame(multi), platformIds: [pc.id, nintendo.id] };
    expect(toUpdateRequest(multi, draft)).toEqual({});
  });

  it("sends only the changed fields and null to clear the cover and description", () => {
    const draft = { ...draftFromGame(game), title: "  Celeste (Switch) ", coverImageUrl: "", description: "  " };
    expect(isDraftDirty(game, draft)).toBe(true);
    expect(toUpdateRequest(game, draft)).toEqual({
      title: "Celeste (Switch)",
      coverImageUrl: null,
      description: null,
    });

    const recover = { ...draftFromGame({ ...game, coverImageUrl: null }), coverImageUrl: "https://img.example/n.png" };
    expect(toUpdateRequest({ ...game, coverImageUrl: null }, recover)).toEqual({
      coverImageUrl: "https://img.example/n.png",
    });
  });

  it("reports a changed platform selection and rating", () => {
    const draft = { ...draftFromGame(game), platformIds: [playstation.id], rating: null };
    expect(toUpdateRequest(game, draft)).toEqual({ platformIds: [playstation.id], rating: null });
  });

  it("builds a create request with a trimmed title and null for no cover/description", () => {
    const empty = emptyGameDraft();
    expect(isDraftValid(empty)).toBe(false);
    expect(() => toCreateRequest(empty)).toThrow();

    const draft = {
      title: " Hades ",
      releaseYear: 2020,
      platformIds: [pc.id],
      description: " ",
      rating: null,
      coverImageUrl: " ",
    };
    expect(toCreateRequest(draft)).toEqual({
      title: "Hades",
      releaseYear: 2020,
      platformIds: [pc.id],
      description: null,
      rating: null,
      coverImageUrl: null,
    });
  });
});
