import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { celeste, hades } from "../../../test/fixtures/games";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import type { GameSort } from "../../../types/api";
import { EMPTY_FILTERS } from "../domain/gameFilters";
import { ALL_GAMES_PAGE_SIZE } from "../domain/gameValues";
import { useAllGames } from "./useAllGames";

const page = (items: (typeof celeste)[], pageNum: number, totalPages: number) => ({
  items,
  page: pageNum,
  pageSize: ALL_GAMES_PAGE_SIZE,
  totalItems: items.length,
  totalPages,
});

describe("useAllGames", () => {
  it("loads all games across pages and exposes them once settled", async () => {
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const requestedPage = Number(url.searchParams.get("page"));
        return requestedPage === 1 ? jsonResponse(page([celeste], 1, 2)) : jsonResponse(page([hades], 2, 2));
      },
    });
    const { result } = renderHook(() => useAllGames("", EMPTY_FILTERS, "load failed"));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([celeste, hades]);
    expect(calls).toHaveLength(2);
  });

  it("reloads on demand", async () => {
    const calls = mockApi({ "GET /api/games": () => jsonResponse(page([celeste], 1, 1)) });
    const { result } = renderHook(() => useAllGames("", EMPTY_FILTERS, "load failed"));
    await waitFor(() => expect(result.current.items).toEqual([celeste]));

    act(() => result.current.reload());
    await waitFor(() => expect(calls).toHaveLength(2));
  });

  it("exposes the backend message on failure and keeps the old items", async () => {
    let fail = false;
    mockApi({
      "GET /api/games": () =>
        fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(page([celeste], 1, 1)),
    });
    const { result } = renderHook(() => useAllGames("", EMPTY_FILTERS, "load failed"));
    await waitFor(() => expect(result.current.items).toEqual([celeste]));

    fail = true;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.items).toEqual([celeste]);
    expect(result.current.loading).toBe(false);
  });

  it("refetches when the sort or rated option changes", async () => {
    const calls = mockApi({ "GET /api/games": () => jsonResponse(page([celeste], 1, 1)) });
    const { rerender } = renderHook(
      ({ sort, rated }: { sort?: GameSort; rated?: boolean }) =>
        useAllGames("", EMPTY_FILTERS, "load failed", sort, rated),
      { initialProps: { sort: undefined as GameSort | undefined, rated: undefined as boolean | undefined } },
    );
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe(`/api/games?page=1&pageSize=${ALL_GAMES_PAGE_SIZE}`);

    rerender({ sort: "rating_desc", rated: true });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].url).toBe(`/api/games?page=1&pageSize=${ALL_GAMES_PAGE_SIZE}&sort=rating_desc&rated=true`);
  });

  it("ignores a stale response from before a reload once the reload's response has arrived", async () => {
    const resolvers: ((response: Response) => void)[] = [];
    mockApi({
      "GET /api/games": () => new Promise<Response>((resolve) => resolvers.push(resolve)),
    });
    const { result } = renderHook(() => useAllGames("", EMPTY_FILTERS, "load failed"));
    await waitFor(() => expect(resolvers).toHaveLength(1));

    act(() => result.current.reload());
    await waitFor(() => expect(resolvers).toHaveLength(2));

    resolvers[1](jsonResponse(page([hades], 1, 1)));
    await waitFor(() => expect(result.current.items).toEqual([hades]));

    resolvers[0](jsonResponse(page([celeste], 1, 1)));
    await flushAsync();
    expect(result.current.items).toEqual([hades]);
  });

  it("stops requesting further pages once a newer reload supersedes the request", async () => {
    const resolvers: ((response: Response) => void)[] = [];
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const requestedPage = Number(url.searchParams.get("page"));
        if (requestedPage === 1) return new Promise<Response>((resolve) => resolvers.push(resolve));
        return jsonResponse(page([hades], 2, 2));
      },
    });
    const { result } = renderHook(() => useAllGames("", EMPTY_FILTERS, "load failed"));
    await waitFor(() => expect(resolvers).toHaveLength(1));

    act(() => result.current.reload());
    await waitFor(() => expect(resolvers).toHaveLength(2));

    // Resolves the superseded (first) request last, with a second page still to fetch; since its effect was
    // already cleaned up (isCancelled reports true), it never requests page 2.
    resolvers[0](jsonResponse(page([celeste], 1, 2)));
    await flushAsync();
    expect(calls.filter((c) => c.url.includes("page=2"))).toHaveLength(0);
  });
});
