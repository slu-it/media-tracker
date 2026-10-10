import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { flushAsync } from "../test/flushAsync";
import type { CoverOptionResponse } from "../types/api";
import { type CoverOptionsLike, type CoverPageRequest, useCoverOptions } from "./useCoverOptions";

type Variant = "a" | "b";
type Fetch = (request: CoverPageRequest<number, Variant>) => Promise<CoverOptionsLike<number>>;

const cover = (name: string): CoverOptionResponse => ({
  thumbnailUrl: `https://cdn/${name}.jpg`,
  imageUrl: `https://cdn/${name}.png`,
  width: 600,
  height: 900,
});

function response(
  names: string[],
  { page = 1, totalPages = 1, totalItems = names.length, selectedMatchId = 7 as number | null } = {},
): CoverOptionsLike<number> {
  return {
    query: "Hades",
    matches: selectedMatchId === null ? [] : [{ id: selectedMatchId, name: "Hades", releaseYear: 2020 }],
    selectedMatchId,
    covers: { items: names.map(cover), page, pageSize: names.length, totalItems, totalPages },
  };
}

const firstPage = response(["a", "b"], { totalPages: 2, totalItems: 4 });
const secondPage = response(["c", "d"], { page: 2, totalPages: 2, totalItems: 4 });
const variantB = response(["x"]);

function args(fetchPage: Fetch, overrides: Partial<Parameters<typeof useCoverOptions<number, Variant>>[0]> = {}) {
  return {
    query: "Hades",
    releaseYear: null,
    match: null,
    variant: "a" as Variant,
    fetchPage,
    unavailableCode: "cover_source_unavailable",
    loadErrorText: "load failed",
    ...overrides,
  };
}

describe("useCoverOptions", () => {
  it("makes no request while the query is blank", async () => {
    const fetchPage = vi.fn<Fetch>().mockResolvedValue(firstPage);
    const { result } = renderHook(() => useCoverOptions(args(fetchPage, { query: "  " })));

    await flushAsync();
    expect(fetchPage).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.covers).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("requests the first page with the release year, the variant and no match or page", async () => {
    const fetchPage = vi.fn<Fetch>().mockResolvedValue(firstPage);
    renderHook(() => useCoverOptions(args(fetchPage, { releaseYear: 2020 })));

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(fetchPage).toHaveBeenCalledWith({ query: "Hades", releaseYear: 2020, match: undefined, variant: "a" });
  });

  it("marks the source unavailable on a 503 with the given code, without an error message", async () => {
    const fetchPage = vi
      .fn<Fetch>()
      .mockRejectedValue(new ApiError(503, "unavailable", { error: "cover_source_unavailable" }));
    const { result } = renderHook(() => useCoverOptions(args(fetchPage)));

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it("treats a 503 with another code as a plain failure", async () => {
    const fetchPage = vi.fn<Fetch>().mockRejectedValue(new ApiError(503, "other", { error: "other" }));
    const { result } = renderHook(() => useCoverOptions(args(fetchPage)));

    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.unavailable).toBe(false);
  });

  it("exposes the given error text on any other failure, ignoring the server's raw message", async () => {
    const fetchPage = vi
      .fn<Fetch>()
      .mockRejectedValue(new ApiError(502, "cover_source is currently unavailable", { error: "internal_error" }));
    const { result } = renderHook(() => useCoverOptions(args(fetchPage)));

    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.unavailable).toBe(false);
  });

  it("appends the next page on loadMore with the selected match and page, and reports no further page after the last", async () => {
    const fetchPage = vi.fn<Fetch>((request) => Promise.resolve(request.page === undefined ? firstPage : secondPage));
    const { result } = renderHook(() => useCoverOptions(args(fetchPage)));
    await waitFor(() => expect(result.current.covers).toHaveLength(2));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.covers).toHaveLength(4));
    expect(result.current.hasMore).toBe(false);
    expect(fetchPage).toHaveBeenLastCalledWith({
      query: "Hades",
      releaseYear: null,
      match: 7,
      variant: "a",
      page: 2,
    });
  });

  it("loads more without a match, sending none", async () => {
    const flat = response(["a", "b"], { totalPages: 2, totalItems: 4, selectedMatchId: null });
    const flat2 = response(["c", "d"], { page: 2, totalPages: 2, totalItems: 4, selectedMatchId: null });
    const fetchPage = vi.fn<Fetch>((request) => Promise.resolve(request.page === undefined ? flat : flat2));
    const { result } = renderHook(() => useCoverOptions(args(fetchPage)));
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.covers).toHaveLength(4));
    expect(fetchPage).toHaveBeenLastCalledWith({
      query: "Hades",
      releaseYear: null,
      match: undefined,
      variant: "a",
      page: 2,
    });
  });

  it("resets the covers to the new response when the variant changes", async () => {
    const fetchPage = vi.fn<Fetch>((request) => Promise.resolve(request.variant === "b" ? variantB : firstPage));
    const { result, rerender } = renderHook(({ variant }) => useCoverOptions(args(fetchPage, { variant })), {
      initialProps: { variant: "a" as Variant },
    });
    await waitFor(() => expect(result.current.covers).toHaveLength(2));

    rerender({ variant: "b" });

    await waitFor(() => expect(result.current.covers).toHaveLength(1));
    expect(result.current.covers[0].thumbnailUrl).toBe("https://cdn/x.jpg");
  });

  it("clears the previous variant's covers and shows the error when switching to a variant whose first page fails", async () => {
    const fetchPage = vi.fn<Fetch>((request) =>
      request.variant === "b"
        ? Promise.reject(new ApiError(500, "failed", { error: "internal_error" }))
        : Promise.resolve(firstPage),
    );
    const { result, rerender } = renderHook(({ variant }) => useCoverOptions(args(fetchPage, { variant })), {
      initialProps: { variant: "a" as Variant },
    });
    await waitFor(() => expect(result.current.covers).toHaveLength(2));

    rerender({ variant: "b" });

    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.covers).toEqual([]);
    expect(result.current.data).toBeNull();
    expect(result.current.hasMore).toBe(false);
  });

  it("does not append a load-more page that resolves only after the variant changed away and back", async () => {
    let resolvePage2!: (value: CoverOptionsLike<number>) => void;
    const page2Promise = new Promise<CoverOptionsLike<number>>((resolve) => {
      resolvePage2 = resolve;
    });
    const fetchPage = vi.fn<Fetch>((request) => {
      if (request.page !== undefined) return page2Promise;
      return Promise.resolve(request.variant === "b" ? variantB : firstPage);
    });
    const { result, rerender } = renderHook(({ variant }) => useCoverOptions(args(fetchPage, { variant })), {
      initialProps: { variant: "a" as Variant },
    });
    await waitFor(() => expect(result.current.covers).toHaveLength(2));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(true));

    rerender({ variant: "b" });
    await waitFor(() => expect(result.current.covers).toHaveLength(1));

    rerender({ variant: "a" });
    await waitFor(() => expect(result.current.covers).toHaveLength(2));

    resolvePage2(secondPage);
    await flushAsync();

    expect(result.current.covers).toHaveLength(2);
  });

  it("clears loaded covers and requests nothing when the query becomes blank", async () => {
    const fetchPage = vi.fn<Fetch>().mockResolvedValue(firstPage);
    const { result, rerender } = renderHook(({ query }) => useCoverOptions(args(fetchPage, { query })), {
      initialProps: { query: "Hades" },
    });
    await waitFor(() => expect(result.current.covers).toHaveLength(2));
    const callCountAfterLoad = fetchPage.mock.calls.length;

    rerender({ query: "  " });

    expect(result.current.data).toBeNull();
    expect(result.current.covers).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.hasMore).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(callCountAfterLoad);
  });

  it("does not request a further page when loadMore is called without one available", async () => {
    const fetchPage = vi.fn<Fetch>().mockResolvedValue(variantB);
    const { result } = renderHook(() => useCoverOptions(args(fetchPage)));
    await waitFor(() => expect(result.current.covers).toHaveLength(1));
    expect(result.current.hasMore).toBe(false);

    act(() => result.current.loadMore());

    await flushAsync();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("does not reload when only the fetchPage identity changes", async () => {
    const first = vi.fn<Fetch>().mockResolvedValue(firstPage);
    const second = vi.fn<Fetch>().mockResolvedValue(firstPage);
    const { result, rerender } = renderHook(({ fetchPage }) => useCoverOptions(args(fetchPage)), {
      initialProps: { fetchPage: first },
    });
    await waitFor(() => expect(result.current.covers).toHaveLength(2));

    rerender({ fetchPage: second });

    await flushAsync();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
