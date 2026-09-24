import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import type { CoverMatchResponse, TitleSuggestionsResponse } from "../../../types/api";
import { useTitleSuggestions } from "./useTitleSuggestions";

const response: TitleSuggestionsResponse = {
  suggestions: [{ id: 5245, name: "Hollow Knight", releaseYear: 2017, verified: true }],
};

describe("useTitleSuggestions", () => {
  it("makes no request while the debounced title is under the minimum length", async () => {
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const { result } = renderHook(() => useTitleSuggestions("Hade", true, 10));

    await flushAsync();
    expect(calls).toHaveLength(0);
    expect(result.current).toEqual([]);
  });

  it("makes no request while not enabled", async () => {
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const { result } = renderHook(() => useTitleSuggestions("Hollow Knight", false, 10));

    await flushAsync();
    expect(calls).toHaveLength(0);
    expect(result.current).toEqual([]);
  });

  it("fires a single debounced request once typing settles", async () => {
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    // `useDebouncedValue` adopts its very first value immediately, so mounting already at/above the threshold
    // would fire an extra request for that initial value; starting below it keeps this test to the one, settled
    // request a burst of edits should produce.
    const { result, rerender } = renderHook(({ title }) => useTitleSuggestions(title, true, 20), {
      initialProps: { title: "Holl" },
    });
    rerender({ title: "Hollow" });
    rerender({ title: "Hollow K" });

    await waitFor(() => expect(result.current).toEqual(response.suggestions));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/games/title-suggestions?query=Hollow+K");
  });

  it("resolves to an empty list on a server error", async () => {
    // `result.current` starts out as `[]`, so a hook that never actually requested anything would pass a naive
    // version of this test just as well: first settle a real, successful result for "Hollow Knight", then edit
    // to "Celeste" and have that request 500. Rerendering back to "Hollow Knight" afterwards and asserting `[]`
    // *immediately* (no `waitFor`) is the part that actually pins the error handling: `loaded.query` only still
    // reads "Hollow Knight" there if the 500 was never turned into a `setLoaded` call, in which case the stale,
    // successful suggestions from the first request would resurface.
    const calls = mockApi({
      "GET /api/games/title-suggestions": (_call, url) =>
        url.searchParams.get("query") === "Hollow Knight"
          ? jsonResponse(response)
          : jsonResponse({ error: "internal_error" }, 500),
    });
    const { result, rerender } = renderHook(({ title }) => useTitleSuggestions(title, true, 10), {
      initialProps: { title: "Hollow Knight" },
    });
    await waitFor(() => expect(result.current).toEqual(response.suggestions));

    rerender({ title: "Celeste" });
    await waitFor(() => expect(calls).toHaveLength(2));
    // Let the 500 response actually resolve and be handled before rerendering back, so the immediate assertion
    // below is not just racing an in-flight request.
    await flushAsync();

    rerender({ title: "Hollow Knight" });
    expect(result.current).toEqual([]);
  });

  it("drops the results once the term is edited back under the minimum length", async () => {
    mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const { result, rerender } = renderHook(({ title }) => useTitleSuggestions(title, true, 10), {
      initialProps: { title: "Hollow Knight" },
    });
    await waitFor(() => expect(result.current).toEqual(response.suggestions));

    rerender({ title: "Ho" });

    await waitFor(() => expect(result.current).toEqual([]));
  });

  it("clears the results immediately once the live title drops under the minimum, without waiting for the debounce", async () => {
    mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    // A long debounce keeps `debouncedTitle` at "Hollow Knight" well past the rerender below, isolating the
    // immediate, live-title-driven clear from the (separately covered) debounced one.
    const { result, rerender } = renderHook(({ title }) => useTitleSuggestions(title, true, 1000), {
      initialProps: { title: "Hollow Knight" },
    });
    await waitFor(() => expect(result.current).toEqual(response.suggestions));

    rerender({ title: "Ho" });

    expect(result.current).toEqual([]);
  });

  it("makes no request for a title over the backend's maximum length", async () => {
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const { result } = renderHook(() => useTitleSuggestions("x".repeat(201), true, 10));

    await flushAsync();
    expect(calls).toHaveLength(0);
    expect(result.current).toEqual([]);
  });

  it("never requests the pre-edit title when enabled flips true on the same edit that changes it", async () => {
    // `useDebouncedValue` adopts its first value immediately, so mounting disabled at "Celeste" already leaves
    // `debouncedTitle` at "Celeste". If `enabled` flipping true fired for whatever `debouncedTitle` currently
    // holds, this rerender would fire an undebounced request for the stale "Celeste" alongside the settled one
    // for "Hollow Knight". Asserting there is exactly one call, for the new title, is the positive control that
    // proves the hook did fetch, just never for the stale value.
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const { rerender } = renderHook(({ title, enabled }) => useTitleSuggestions(title, enabled, 10), {
      initialProps: { title: "Celeste", enabled: false },
    });

    rerender({ title: "Hollow Knight", enabled: true });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe("/api/games/title-suggestions?query=Hollow+Knight");
  });

  it("ignores a stale response that resolves after a newer request already settled", async () => {
    let resolveHollow!: (response: Response) => void;
    const hollowPromise = new Promise<Response>((resolve) => {
      resolveHollow = resolve;
    });
    const celesteSuggestions: CoverMatchResponse[] = [{ id: 2, name: "Celeste", releaseYear: 2018, verified: true }];
    const calls = mockApi({
      "GET /api/games/title-suggestions": (_call, url) =>
        url.searchParams.get("query") === "Hollow" ? hollowPromise : jsonResponse({ suggestions: celesteSuggestions }),
    });
    const { result, rerender } = renderHook(({ title }) => useTitleSuggestions(title, true, 20), {
      initialProps: { title: "Hollow" },
    });
    await waitFor(() => expect(calls).toHaveLength(1));

    rerender({ title: "Celeste" });
    await waitFor(() => expect(result.current).toEqual(celesteSuggestions));

    resolveHollow(jsonResponse(response));
    await flushAsync();
    expect(result.current).toEqual(celesteSuggestions);
  });
});
