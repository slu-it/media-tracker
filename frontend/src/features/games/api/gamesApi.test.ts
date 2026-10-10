import { describe, expect, it } from "vitest";
import { celeste, hades, teamCherry } from "../../../test/fixtures/games";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import type { GameResponse, PageResponse } from "../../../types/api";
import { EMPTY_FILTERS, type GameFilters } from "../domain/gameFilters";
import { ALL_GAMES_PAGE_SIZE } from "../domain/gameValues";
import {
  deleteGameDeveloper,
  listAllGames,
  listDeveloperGames,
  listGameDeveloperSummaries,
  listGames,
  mergeGameDeveloper,
  renameGameDeveloper,
} from "./gamesApi";

const page = (items: GameResponse[], pageNum: number, totalPages: number): PageResponse<GameResponse> => ({
  items,
  page: pageNum,
  pageSize: ALL_GAMES_PAGE_SIZE,
  totalItems: items.length,
  totalPages,
});

describe("listGames", () => {
  it('omits the sort param for the default (undefined or "title")', async () => {
    const calls = mockApi({ "GET /api/games": () => jsonResponse(page([], 1, 0)) });
    await listGames(1, 50, "", EMPTY_FILTERS);
    await listGames(1, 50, "", EMPTY_FILTERS, "title");
    expect(calls[0].url).toBe("/api/games?page=1&pageSize=50");
    expect(calls[1].url).toBe("/api/games?page=1&pageSize=50");
  });

  it("adds the sort param for a non-default sort", async () => {
    const calls = mockApi({ "GET /api/games": () => jsonResponse(page([], 1, 0)) });
    await listGames(1, 50, "", EMPTY_FILTERS, "release_desc");
    expect(calls[0].url).toBe("/api/games?page=1&pageSize=50&sort=release_desc");
  });

  it("sends rated=true only when rated is true", async () => {
    const calls = mockApi({ "GET /api/games": () => jsonResponse(page([], 1, 0)) });
    await listGames(1, 50, "", EMPTY_FILTERS, undefined, false);
    await listGames(1, 50, "", EMPTY_FILTERS, undefined, undefined);
    await listGames(1, 50, "", EMPTY_FILTERS, undefined, true);
    expect(calls[0].url).toBe("/api/games?page=1&pageSize=50");
    expect(calls[1].url).toBe("/api/games?page=1&pageSize=50");
    expect(calls[2].url).toBe("/api/games?page=1&pageSize=50&rated=true");
  });

  it("combines sort and rated with the existing filter params", async () => {
    const calls = mockApi({ "GET /api/games": () => jsonResponse(page([], 1, 0)) });
    const filters: GameFilters = { platformIds: [], ownership: ["owned"], progress: [], releaseYears: [] };
    await listGames(1, 50, "", filters, "rating_desc", true);
    expect(calls[0].url).toBe("/api/games?page=1&pageSize=50&ownership=owned&sort=rating_desc&rated=true");
  });
});

describe("listAllGames", () => {
  it("returns all items from a single page", async () => {
    const calls = mockApi({ "GET /api/games": () => jsonResponse(page([celeste, hades], 1, 1)) });
    const items = await listAllGames("", EMPTY_FILTERS);
    expect(items).toEqual([celeste, hades]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`/api/games?page=1&pageSize=${ALL_GAMES_PAGE_SIZE}`);
  });

  it("fetches every page sequentially and concatenates the items", async () => {
    const third: GameResponse = { ...celeste, id: "id-3", title: "Third Page Game" };
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const requestedPage = Number(url.searchParams.get("page"));
        if (requestedPage === 1) return jsonResponse(page([celeste], 1, 3));
        if (requestedPage === 2) return jsonResponse(page([hades], 2, 3));
        return jsonResponse(page([third], 3, 3));
      },
    });
    const items = await listAllGames("", EMPTY_FILTERS);
    expect(items).toEqual([celeste, hades, third]);
    expect(calls.map((call) => call.url)).toEqual([
      `/api/games?page=1&pageSize=${ALL_GAMES_PAGE_SIZE}`,
      `/api/games?page=2&pageSize=${ALL_GAMES_PAGE_SIZE}`,
      `/api/games?page=3&pageSize=${ALL_GAMES_PAGE_SIZE}`,
    ]);
  });

  it("stops paging once a later page fails", async () => {
    let callCount = 0;
    mockApi({
      "GET /api/games": (_call, url) => {
        callCount++;
        const requestedPage = Number(url.searchParams.get("page"));
        if (requestedPage === 1) return jsonResponse(page([celeste], 1, 3));
        return jsonResponse({ error: "internal_error" }, 500);
      },
    });
    await expect(listAllGames("", EMPTY_FILTERS)).rejects.toThrow();
    expect(callCount).toBe(2);
  });

  it("forwards sort and rated to every page request", async () => {
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const requestedPage = Number(url.searchParams.get("page"));
        return requestedPage === 1 ? jsonResponse(page([celeste], 1, 2)) : jsonResponse(page([hades], 2, 2));
      },
    });
    await listAllGames("", EMPTY_FILTERS, "rating_desc", true);
    expect(calls.map((call) => call.url)).toEqual([
      `/api/games?page=1&pageSize=${ALL_GAMES_PAGE_SIZE}&sort=rating_desc&rated=true`,
      `/api/games?page=2&pageSize=${ALL_GAMES_PAGE_SIZE}&sort=rating_desc&rated=true`,
    ]);
  });

  it("stops requesting further pages once isCancelled reports true", async () => {
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const requestedPage = Number(url.searchParams.get("page"));
        if (requestedPage === 1) return jsonResponse(page([celeste], 1, 3));
        if (requestedPage === 2) return jsonResponse(page([hades], 2, 3));
        return jsonResponse(page([celeste], 3, 3));
      },
    });
    const items = await listAllGames("", EMPTY_FILTERS, undefined, undefined, {
      isCancelled: () => calls.length >= 2,
    });
    expect(items).toEqual([celeste, hades]);
    expect(calls).toHaveLength(2);
  });

  it("dedupes items by id, keeping the first occurrence", async () => {
    mockApi({
      "GET /api/games": (_call, url) => {
        const requestedPage = Number(url.searchParams.get("page"));
        // A page shifting between requests can return the same item on two pages; the first copy wins.
        if (requestedPage === 1) return jsonResponse(page([celeste, hades], 1, 2));
        return jsonResponse(page([hades], 2, 2));
      },
    });
    const items = await listAllGames("", EMPTY_FILTERS);
    expect(items).toEqual([celeste, hades]);
  });
});

describe("game developers", () => {
  it("lists the summaries", async () => {
    const summaries = [{ id: "developer-1", name: "Team Cherry", gameCount: 2 }];
    const calls = mockApi({ "GET /api/game-developers.summaries": () => jsonResponse(summaries) });
    expect(await listGameDeveloperSummaries()).toEqual(summaries);
    expect(calls[0].url).toBe("/api/game-developers.summaries");
  });

  it("lists the games of a developer", async () => {
    const calls = mockApi({ "GET /api/game-developers/:id/games": () => jsonResponse([celeste]) });
    expect(await listDeveloperGames("dev/1")).toEqual([celeste]);
    expect(calls[0].url).toBe("/api/game-developers/dev%2F1/games");
  });

  it("renames, merges and deletes a developer", async () => {
    const calls = mockApi({
      "PATCH /api/game-developers/:id": () => jsonResponse(teamCherry),
      "POST /api/game-developers/:id/merge": () => jsonResponse(teamCherry),
      "DELETE /api/game-developers/:id": () => new Response(null, { status: 204 }),
    });
    expect(await renameGameDeveloper("d/1", "Cherry")).toEqual(teamCherry);
    expect(await mergeGameDeveloper("d/1", "d-2")).toEqual(teamCherry);
    await deleteGameDeveloper("d/1");
    expect(calls).toEqual([
      { method: "PATCH", url: "/api/game-developers/d%2F1", body: { name: "Cherry" } },
      { method: "POST", url: "/api/game-developers/d%2F1/merge", body: { targetId: "d-2" } },
      { method: "DELETE", url: "/api/game-developers/d%2F1", body: undefined },
    ]);
  });
});
