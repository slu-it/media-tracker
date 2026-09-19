import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { useGamesPage } from "./useGamesPage";

const page = (n: number) => ({ items: [], page: n, pageSize: 50, totalItems: 0, totalPages: 0 });

describe("useGamesPage", () => {
  it("fetches the requested page, refetches on page change and on reload", async () => {
    const calls = mockApi({
      "GET /api/games": (_call, url) => jsonResponse(page(Number(url.searchParams.get("page")))),
    });
    const { result, rerender } = renderHook(({ p }) => useGamesPage(p, 50, "", "load failed"), {
      initialProps: { p: 1 },
    });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.page).toBe(1);
    expect(calls[0].url).toBe("/api/games?page=1&pageSize=50");

    rerender({ p: 2 });
    expect(result.current.loading).toBe(true);
    expect(result.current.data?.page).toBe(1); // previous page stays visible while loading
    await waitFor(() => expect(result.current.data?.page).toBe(2));

    act(() => result.current.reload());
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2].url).toBe("/api/games?page=2&pageSize=50");
  });

  it("exposes the backend message on failure and keeps the old data", async () => {
    let fail = false;
    mockApi({
      "GET /api/games": () => (fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(page(1))),
    });
    const { result } = renderHook(() => useGamesPage(1, 50, "", "load failed"));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    fail = true;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.data?.page).toBe(1);
    expect(result.current.loading).toBe(false);
  });

  it("keeps the previous page visible and reports loading while the next page loads", async () => {
    const resolvers = new Map<number, (response: Response) => void>();
    mockApi({
      "GET /api/games": (_call, url) => {
        const requestedPage = Number(url.searchParams.get("page"));
        return new Promise<Response>((resolve) => resolvers.set(requestedPage, resolve));
      },
    });
    const { result, rerender } = renderHook(({ p }) => useGamesPage(p, 50, "", "load failed"), {
      initialProps: { p: 1 },
    });
    resolvers.get(1)!(jsonResponse(page(1)));
    await waitFor(() => expect(result.current.data?.page).toBe(1));
    expect(result.current.loading).toBe(false);

    rerender({ p: 2 });
    expect(result.current.loading).toBe(true);
    expect(result.current.data?.page).toBe(1);

    resolvers.get(2)!(jsonResponse(page(2)));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.page).toBe(2);
  });

  it("ignores the response of a superseded request", async () => {
    const resolvers = new Map<number, (response: Response) => void>();
    mockApi({
      "GET /api/games": (_call, url) => {
        const requestedPage = Number(url.searchParams.get("page"));
        return new Promise<Response>((resolve) => resolvers.set(requestedPage, resolve));
      },
    });
    const { result, rerender } = renderHook(({ p }) => useGamesPage(p, 50, "", "load failed"), {
      initialProps: { p: 1 },
    });

    rerender({ p: 2 });
    resolvers.get(2)!(jsonResponse(page(2)));
    await waitFor(() => expect(result.current.data?.page).toBe(2));
    expect(result.current.loading).toBe(false);

    resolvers.get(1)!(jsonResponse(page(1)));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.data?.page).toBe(2);
    expect(result.current.loading).toBe(false);
  });

  it("adds the search term to the query and refetches when it changes", async () => {
    const calls = mockApi({
      "GET /api/games": () => jsonResponse(page(1)),
    });
    const { rerender } = renderHook(({ search }) => useGamesPage(1, 50, search, "load failed"), {
      initialProps: { search: "" },
    });
    await waitFor(() => expect(calls).toHaveLength(1));

    rerender({ search: "hades" });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].url).toBe("/api/games?page=1&pageSize=50&search=hades");
  });

  it("omits the search param for a blank term", async () => {
    const calls = mockApi({
      "GET /api/games": () => jsonResponse(page(1)),
    });
    renderHook(() => useGamesPage(1, 50, "", "load failed"));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe("/api/games?page=1&pageSize=50");
  });

  it("reload keeps the active search term", async () => {
    const calls = mockApi({
      "GET /api/games": () => jsonResponse(page(1)),
    });
    const { result } = renderHook(() => useGamesPage(1, 50, "hades", "load failed"));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => result.current.reload());
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].url).toBe("/api/games?page=1&pageSize=50&search=hades");
  });
});
