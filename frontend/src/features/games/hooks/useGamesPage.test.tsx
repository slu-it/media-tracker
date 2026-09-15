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
    const { result, rerender } = renderHook(({ p }) => useGamesPage(p, 50, "load failed"), {
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
    const { result } = renderHook(() => useGamesPage(1, 50, "load failed"));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    fail = true;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.data?.page).toBe(1);
    expect(result.current.loading).toBe(false);
  });
});
