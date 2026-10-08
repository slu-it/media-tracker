import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { EMPTY_BOOK_FILTERS } from "../domain/bookFilters";
import { useBooksPage } from "./useBooksPage";

const page = (n: number) => ({ items: [], page: n, pageSize: 36, totalItems: 0, totalPages: 0 });

describe("useBooksPage", () => {
  it("fetches the requested page, refetches on page change and on reload", async () => {
    const calls = mockApi({
      "GET /api/books": (_call, url) => jsonResponse(page(Number(url.searchParams.get("page")))),
    });
    const { result, rerender } = renderHook(({ p }) => useBooksPage(p, 36, "", EMPTY_BOOK_FILTERS, "load failed"), {
      initialProps: { p: 1 },
    });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls[0].url).toBe("/api/books?page=1&pageSize=36");

    rerender({ p: 2 });
    expect(result.current.loading).toBe(true);
    expect(result.current.data?.page).toBe(1); // previous page stays visible while loading
    await waitFor(() => expect(result.current.data?.page).toBe(2));

    act(() => result.current.reload());
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2].url).toBe("/api/books?page=2&pageSize=36");
  });

  it("exposes the load error text on failure and keeps the old data", async () => {
    let fail = false;
    mockApi({
      "GET /api/books": () => (fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(page(1))),
    });
    const { result } = renderHook(() => useBooksPage(1, 36, "", EMPTY_BOOK_FILTERS, "load failed"));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    fail = true;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.data?.page).toBe(1);
    expect(result.current.loading).toBe(false);
  });
});
