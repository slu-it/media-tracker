import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { hadesAnimatedCoverOptions, hadesCoverOptions, hadesCoverOptionsPage2 } from "../../../test/fixtures/games";
import type { CoverOptionsResponse, CoverType } from "../../../types/api";
import { useCoverOptions } from "./useCoverOptions";

describe("useCoverOptions", () => {
  it("marks the source unavailable on a 503 cover_source_unavailable, without an error message", async () => {
    mockApi({
      "GET /api/games/:id/cover-options": () => jsonResponse({ error: "cover_source_unavailable" }, 503),
    });
    const { result } = renderHook(() => useCoverOptions("id-2", "Hades", null, "static", "load failed"));

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it("exposes the given error text on any other failure, ignoring the server's raw message", async () => {
    mockApi({
      "GET /api/games/:id/cover-options": () =>
        jsonResponse({ error: "internal_error", message: "cover_source is currently unavailable" }, 502),
    });
    const { result } = renderHook(() => useCoverOptions("id-2", "Hades", null, "static", "load failed"));

    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.unavailable).toBe(false);
  });

  it("appends the next page on loadMore and reports no further page once the last one arrived", async () => {
    const page1: CoverOptionsResponse = {
      query: "Hades",
      matches: [{ id: 5245, name: "Hades", releaseYear: 2020, verified: true }],
      selectedMatchId: 5245,
      type: "static",
      covers: {
        items: [{ thumbnailUrl: "https://cdn/a.jpg", imageUrl: "https://cdn/a.png", width: 600, height: 900 }],
        page: 1,
        pageSize: 1,
        totalItems: 2,
        totalPages: 2,
      },
    };
    const page2: CoverOptionsResponse = {
      ...page1,
      covers: {
        items: [{ thumbnailUrl: "https://cdn/b.jpg", imageUrl: "https://cdn/b.png", width: 600, height: 900 }],
        page: 2,
        pageSize: 1,
        totalItems: 2,
        totalPages: 2,
      },
    };
    mockApi({
      "GET /api/games/:id/cover-options": (_call, url) => jsonResponse(url.searchParams.has("page") ? page2 : page1),
    });
    const { result } = renderHook(() => useCoverOptions("id-2", "Hades", null, "static", "load failed"));
    await waitFor(() => expect(result.current.covers).toHaveLength(1));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.covers).toHaveLength(2));
    expect(result.current.hasMore).toBe(false);
  });

  it("resets the covers to the new response when the type changes", async () => {
    mockApi({
      "GET /api/games/:id/cover-options": (_call, url) =>
        jsonResponse(url.searchParams.get("type") === "animated" ? hadesAnimatedCoverOptions : hadesCoverOptions),
    });
    const { result, rerender } = renderHook(({ type }) => useCoverOptions("id-2", "Hades", null, type, "load failed"), {
      initialProps: { type: "static" as CoverType },
    });
    await waitFor(() => expect(result.current.covers).toHaveLength(2));

    rerender({ type: "animated" });

    await waitFor(() => expect(result.current.covers).toHaveLength(1));
    expect(result.current.covers[0].thumbnailUrl).toBe(hadesAnimatedCoverOptions.covers.items[0].thumbnailUrl);
  });

  it("clears the previous type's covers and shows the error when switching to a type whose first page fails", async () => {
    mockApi({
      "GET /api/games/:id/cover-options": (_call, url) =>
        url.searchParams.get("type") === "animated"
          ? jsonResponse({ error: "internal_error" }, 500)
          : jsonResponse(hadesCoverOptions),
    });
    const { result, rerender } = renderHook(({ type }) => useCoverOptions("id-2", "Hades", null, type, "load failed"), {
      initialProps: { type: "static" as CoverType },
    });
    await waitFor(() => expect(result.current.covers).toHaveLength(2));

    rerender({ type: "animated" });

    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.covers).toEqual([]);
    expect(result.current.data).toBeNull();
    expect(result.current.hasMore).toBe(false);
  });

  it("does not append a load-more page that resolves only after the type changed away and back", async () => {
    let resolvePage2!: (response: Response) => void;
    const page2Promise = new Promise<Response>((resolve) => {
      resolvePage2 = resolve;
    });
    mockApi({
      "GET /api/games/:id/cover-options": (_call, url) => {
        if (url.searchParams.has("page")) return page2Promise;
        return jsonResponse(
          url.searchParams.get("type") === "animated" ? hadesAnimatedCoverOptions : hadesCoverOptions,
        );
      },
    });
    const { result, rerender } = renderHook(({ type }) => useCoverOptions("id-2", "Hades", null, type, "load failed"), {
      initialProps: { type: "static" as CoverType },
    });
    await waitFor(() => expect(result.current.covers).toHaveLength(2));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(true));

    rerender({ type: "animated" });
    await waitFor(() => expect(result.current.covers).toHaveLength(1));

    rerender({ type: "static" });
    await waitFor(() => expect(result.current.covers).toHaveLength(2));

    await act(async () => {
      resolvePage2(jsonResponse(hadesCoverOptionsPage2));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.covers).toHaveLength(2);
  });

  it("does not request a further page when loadMore is called without one available", async () => {
    const calls = mockApi({
      "GET /api/games/:id/cover-options": () => jsonResponse(hadesAnimatedCoverOptions),
    });
    const { result } = renderHook(() => useCoverOptions("id-2", "Hades", null, "animated", "load failed"));
    await waitFor(() => expect(result.current.hasMore).toBe(false));

    act(() => result.current.loadMore());

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toHaveLength(1);
  });
});
