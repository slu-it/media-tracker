import { describe, expect, it } from "vitest";
import type { GameResponse } from "../../../types/api";
import {
  celeste,
  hadesSeries,
  nintendo,
  pc,
  playstation,
  celesteSeries,
  supergiantGames,
  teamCherry,
} from "../../../test/fixtures/games";
import { withReleaseDate } from "../../../domain/media/draft";
import {
  type ResolvedGameLinks,
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

function links(over: Partial<ResolvedGameLinks> = {}): ResolvedGameLinks {
  return { developerIds: [], series: [], ...over };
}

describe("gameDraft", () => {
  it("round-trips a game and knows when nothing changed", () => {
    const draft = draftFromGame(game, "en");
    expect(isDraftValid(draft)).toBe(true);
    expect(isDraftDirty(game, draft)).toBe(false);
    expect(toUpdateRequest(game, draft, links())).toEqual({});
  });

  it("does not report a change when platform ids are the same set in a different order", () => {
    const multi = { ...game, platforms: [nintendo, pc] };
    const draft = { ...draftFromGame(multi, "en"), platformIds: [pc.id, nintendo.id] };
    expect(toUpdateRequest(multi, draft, links())).toEqual({});
  });

  it("sends only the changed fields and null to clear the cover and description", () => {
    const draft = { ...draftFromGame(game, "en"), title: "  Celeste (Switch) ", coverImageUrl: "", description: "  " };
    expect(isDraftDirty(game, draft)).toBe(true);
    expect(toUpdateRequest(game, draft, links())).toEqual({
      title: "Celeste (Switch)",
      coverImageUrl: null,
      description: null,
    });

    const recover = {
      ...draftFromGame({ ...game, coverImageUrl: null }, "en"),
      coverImageUrl: "https://img.example/n.png",
    };
    expect(toUpdateRequest({ ...game, coverImageUrl: null }, recover, links())).toEqual({
      coverImageUrl: "https://img.example/n.png",
    });
  });

  it("reports a changed platform selection and rating", () => {
    const draft = { ...draftFromGame(game, "en"), platformIds: [playstation.id], rating: null };
    expect(toUpdateRequest(game, draft, links())).toEqual({ platformIds: [playstation.id], rating: null });
  });

  it("builds a create request with a trimmed title and null for no cover/description", () => {
    const empty = emptyGameDraft();
    expect(isDraftValid(empty)).toBe(false);
    expect(() => toCreateRequest(empty, links())).toThrow();

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
      series: [],
    };
    expect(toCreateRequest(draft, links())).toEqual({
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
    const draft = draftFromGame(game, "en");
    expect(draft.ownership).toBe("owned");
    expect(draft.progress).toBe("playing");
    expect(draft.hidden).toBe(false);
    expect(isDraftDirty(game, draft)).toBe(false);
  });

  it("sends only ownership, progress and hidden that changed", () => {
    const draft = { ...draftFromGame(game, "en"), progress: "completed" as const, hidden: true };
    expect(isDraftDirty(game, draft)).toBe(true);
    expect(toUpdateRequest(game, draft, links())).toEqual({ progress: "completed", hidden: true });
  });

  it("sends the changed release date and null to clear it", () => {
    const dated = { ...game, releaseDate: "2018-01-25" };
    const draft = withReleaseDate(draftFromGame(dated, "en"), "2020-03-01");
    expect(toUpdateRequest(dated, draft, links())).toEqual({ releaseDate: "2020-03-01", releaseYear: 2020 });

    const cleared = withReleaseDate(draftFromGame(dated, "en"), null);
    expect(toUpdateRequest(dated, cleared, links())).toEqual({ releaseDate: null });
  });
});

describe("gameDraft developers", () => {
  it("carries a game's developers into the draft", () => {
    const withDevelopers = { ...game, developers: [teamCherry, supergiantGames] };
    const draft = draftFromGame(withDevelopers, "en");
    expect(draft.developers).toEqual([teamCherry, supergiantGames]);
  });

  it("includes developerIds in a create request only when given", () => {
    const draft = { ...draftFromGame(game, "en"), developers: [] };
    expect(toCreateRequest(draft, links())).not.toHaveProperty("developerIds");
    expect(toCreateRequest(draft, links({ developerIds: [teamCherry.id, supergiantGames.id] }))).toMatchObject({
      developerIds: [teamCherry.id, supergiantGames.id],
    });
  });

  it("sends developerIds only when the resolved set differs from the game's, order-insensitive", () => {
    const withDevelopers = { ...game, developers: [teamCherry, supergiantGames] };
    const draft = draftFromGame(withDevelopers, "en");
    expect(
      toUpdateRequest(withDevelopers, draft, links({ developerIds: [supergiantGames.id, teamCherry.id] })),
    ).toEqual({});
    expect(toUpdateRequest(withDevelopers, draft, links({ developerIds: [teamCherry.id] }))).toEqual({
      developerIds: [teamCherry.id],
    });
  });

  it("is dirty when a pending developer is present, even before it resolves to an id", () => {
    const draft = { ...draftFromGame(game, "en"), developers: [{ name: "New Studio" }] };
    expect(isDraftDirty(game, draft)).toBe(true);
  });

  it("is dirty when the existing developer selection differs from the game's", () => {
    const withDevelopers = { ...game, developers: [teamCherry] };
    const draft = { ...draftFromGame(withDevelopers, "en"), developers: [supergiantGames] };
    expect(isDraftDirty(withDevelopers, draft)).toBe(true);
  });

  it("is not dirty when the existing developer selection is unchanged", () => {
    const withDevelopers = { ...game, developers: [teamCherry, supergiantGames] };
    const draft = draftFromGame(withDevelopers, "en");
    expect(isDraftDirty(withDevelopers, draft)).toBe(false);
  });
});

describe("gameDraft series", () => {
  const inSeries: GameResponse = {
    ...game,
    series: [
      { id: hadesSeries.id, name: hadesSeries.name, position: 1 },
      { id: celesteSeries.id, name: celesteSeries.name, position: null },
    ],
  };

  it("formats existing positions into the draft", () => {
    expect(draftFromGame({ ...game, series: [{ id: "s", name: "S", position: 2.5 }] }, "en").series).toEqual([
      { entry: { id: "s", name: "S" }, position: "2.5" },
    ]);
    expect(draftFromGame(inSeries, "en").series.map((series) => series.position)).toEqual(["1", ""]);
    expect(draftFromGame({ ...game, series: [{ id: "s", name: "S", position: 2.5 }] }, "de").series[0].position).toBe(
      "2,5",
    );
    expect(emptyGameDraft().series).toEqual([]);
  });

  it("sends series only when the set of (id, position) pairs differs", () => {
    const draft = draftFromGame(inSeries, "en");
    const same = [
      { seriesId: celesteSeries.id, position: null },
      { seriesId: hadesSeries.id, position: 1 },
    ];
    expect(toUpdateRequest(inSeries, draft, links({ series: same }))).toEqual({});
    const moved = [
      { seriesId: hadesSeries.id, position: 2.5 },
      { seriesId: celesteSeries.id, position: null },
    ];
    expect(toUpdateRequest(inSeries, draft, links({ series: moved }))).toEqual({ series: moved });
    expect(toUpdateRequest(inSeries, draft, links())).toEqual({ series: [] });
  });

  it("is dirty for an edited position or a pending series, not for an unchanged one", () => {
    const draft = draftFromGame(inSeries, "en");
    expect(isDraftDirty(inSeries, draft)).toBe(false);
    expect(
      isDraftDirty(inSeries, { ...draft, series: [{ ...draft.series[0], position: "1,50" }, draft.series[1]] }),
    ).toBe(true);
    expect(
      isDraftDirty(inSeries, { ...draft, series: [...draft.series, { entry: { name: "New" }, position: "" }] }),
    ).toBe(true);
    expect(
      isDraftDirty(inSeries, { ...draft, series: [{ ...draft.series[0], position: "1.0" }, draft.series[1]] }),
    ).toBe(false);
  });

  it("is invalid while a position is invalid", () => {
    const draft = draftFromGame(inSeries, "en");
    expect(isDraftValid({ ...draft, series: [{ ...draft.series[0], position: "abc" }] })).toBe(false);
  });

  it("includes series in a create request only when non-empty", () => {
    const series = [{ seriesId: hadesSeries.id, position: 1 }];
    expect(toCreateRequest(draftFromGame(inSeries, "en"), links({ series }))).toMatchObject({ series });
    expect(toCreateRequest(draftFromGame(inSeries, "en"), links())).not.toHaveProperty("series");
  });
});
