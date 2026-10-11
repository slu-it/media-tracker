import { describe, expect, it } from "vitest";
import { celeste, hades, hadesSeries, teamCherry } from "../../../test/fixtures/games";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import type { GameResponse, PageResponse } from "../../../types/api";
import { EMPTY_FILTERS, type GameFilters } from "../domain/gameFilters";
import { ALL_GAMES_PAGE_SIZE, SERIES_SEARCH_LIMIT } from "../domain/gameValues";
import {
  createGameSeries,
  deleteGameDeveloper,
  deleteGameSeries,
  listAllGames,
  listDeveloperGames,
  listGameDeveloperSummaries,
  listGameSeriesSummaries,
  listGames,
  listSeriesGames,
  mergeGameDeveloper,
  mergeGameSeries,
  renameGameDeveloper,
  renameGameSeries,
  resolveSeries,
  searchGameSeries,
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

describe("game series", () => {
  it("searches and creates series", async () => {
    const calls = mockApi({
      "GET /api/game-series": () => jsonResponse([hadesSeries]),
      "POST /api/game-series": () => jsonResponse({ id: "series-9", name: "New" }, 201),
    });
    expect(await searchGameSeries(" hades ")).toEqual([hadesSeries]);
    expect(calls[0].url).toBe(`/api/game-series?search=hades&limit=${SERIES_SEARCH_LIMIT}`);
    expect(await createGameSeries("New")).toEqual({ id: "series-9", name: "New" });
    expect(calls[1].body).toEqual({ name: "New" });
  });

  it("resolves series drafts to links, creating pending names", async () => {
    const calls = mockApi({
      "POST /api/game-series": () => jsonResponse({ id: "series-9", name: "New" }, 201),
    });
    const links = await resolveSeries([
      { entry: { name: "New" }, position: "2,5" },
      { entry: hadesSeries, position: "" },
    ]);
    expect(links).toEqual([
      { seriesId: "series-9", position: 2.5 },
      { seriesId: hadesSeries.id, position: null },
    ]);
    expect(calls).toHaveLength(1);
  });

  it("lists the summaries", async () => {
    const summaries = [{ id: "series-1", name: "Hades Saga", gameCount: 2 }];
    const calls = mockApi({ "GET /api/game-series.summaries": () => jsonResponse(summaries) });
    expect(await listGameSeriesSummaries()).toEqual(summaries);
    expect(calls[0].url).toBe("/api/game-series.summaries");
  });

  it("lists the games of a series", async () => {
    const calls = mockApi({ "GET /api/game-series/:id/games": () => jsonResponse([celeste]) });
    expect(await listSeriesGames("s/1")).toEqual([celeste]);
    expect(calls[0].url).toBe("/api/game-series/s%2F1/games");
  });

  it("renames, merges and deletes a series", async () => {
    const calls = mockApi({
      "PATCH /api/game-series/:id": () => jsonResponse(hadesSeries),
      "POST /api/game-series/:id/merge": () => jsonResponse(hadesSeries),
      "DELETE /api/game-series/:id": () => new Response(null, { status: 204 }),
    });
    expect(await renameGameSeries("s/1", "Saga")).toEqual(hadesSeries);
    expect(await mergeGameSeries("s/1", "s-2")).toEqual(hadesSeries);
    await deleteGameSeries("s/1");
    expect(calls).toEqual([
      { method: "PATCH", url: "/api/game-series/s%2F1", body: { name: "Saga" } },
      { method: "POST", url: "/api/game-series/s%2F1/merge", body: { targetId: "s-2" } },
      { method: "DELETE", url: "/api/game-series/s%2F1", body: undefined },
    ]);
  });
});
