import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { meta } from "../../../test/fixtures/games";
import { useGamesMeta } from "./useGamesMeta";

describe("useGamesMeta", () => {
  it("loads the meta once on mount and again on reload", async () => {
    const calls = mockApi({ "GET /api/games.meta": () => jsonResponse(meta) });
    const { result } = renderHook(() => useGamesMeta("load failed"));
    expect(result.current.meta).toBeNull();
    await waitFor(() => expect(result.current.meta).toEqual(meta));

    act(() => result.current.reload());
    await waitFor(() => expect(calls).toHaveLength(2));
  });

  it("exposes the backend message on failure", async () => {
    mockApi({ "GET /api/games.meta": () => jsonResponse({ error: "internal_error" }, 500) });
    const { result } = renderHook(() => useGamesMeta("load failed"));
    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.meta).toBeNull();
  });

  it("ignores a stale response from before the reload once the reload's response has arrived", async () => {
    const reloaded = { ...meta, releaseYears: [2021] };
    const resolvers: ((response: Response) => void)[] = [];
    mockApi({
      "GET /api/games.meta": () => new Promise<Response>((resolve) => resolvers.push(resolve)),
    });
    const { result } = renderHook(() => useGamesMeta("load failed"));
    await waitFor(() => expect(resolvers).toHaveLength(1));

    act(() => result.current.reload());
    await waitFor(() => expect(resolvers).toHaveLength(2));

    // The reload's response arrives first...
    resolvers[1](jsonResponse(reloaded));
    await waitFor(() => expect(result.current.meta).toEqual(reloaded));

    // ...and the stale initial response must not overwrite it once it eventually resolves.
    resolvers[0](jsonResponse(meta));
    await flushAsync();
    expect(result.current.meta).toEqual(reloaded);
  });
});
