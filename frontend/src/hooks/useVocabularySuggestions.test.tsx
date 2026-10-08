import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { developers, teamCherry } from "../test/fixtures/games";
import { flushAsync } from "../test/flushAsync";
import { jsonResponse, mockApi } from "../test/mockFetch";
import { apiFetch } from "../api/client";
import type { GameDeveloperResponse } from "../types/api";
import { useVocabularySuggestions } from "./useVocabularySuggestions";

// A stable module-level fetcher, as the hook requires; the endpoint is incidental to what the hook does.
const searchGameDevelopers = (search: string, signal: AbortSignal) =>
  apiFetch<GameDeveloperResponse[]>(
    `/api/game-developers?${new URLSearchParams({ search: search.trim(), limit: "10" })}`,
    {
      signal,
    },
  );

const useDeveloperSuggestions = (search: string, debounceMs?: number) =>
  useVocabularySuggestions(search, searchGameDevelopers, debounceMs);

describe("useVocabularySuggestions", () => {
  it("makes no request while the search text is empty", async () => {
    const calls = mockApi({ "GET /api/game-developers": () => jsonResponse(developers) });
    const { result } = renderHook(() => useDeveloperSuggestions("", 10));

    await flushAsync();
    expect(calls).toHaveLength(0);
    expect(result.current).toEqual({ suggestions: [], settled: true });
  });

  it("fires a single debounced request once typing settles", async () => {
    const calls = mockApi({ "GET /api/game-developers": () => jsonResponse(developers) });
    // Mounting already at/above the (1-character) minimum would fire an extra request for that initial value
    // (`useDebouncedValue` adopts its first value immediately), so this starts below it to keep the test to the
    // one, settled request a burst of edits should produce.
    const { result, rerender } = renderHook(({ search }) => useDeveloperSuggestions(search, 20), {
      initialProps: { search: "" },
    });
    rerender({ search: "T" });
    rerender({ search: "Te" });
    rerender({ search: "Tea" });

    await waitFor(() => expect(result.current).toEqual({ suggestions: developers, settled: true }));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/game-developers?search=Tea&limit=10");
  });

  it("is not settled while the debounce hasn't caught up or a request is in flight", async () => {
    mockApi({ "GET /api/game-developers": () => jsonResponse(developers) });
    const { result, rerender } = renderHook(({ search }) => useDeveloperSuggestions(search, 20), {
      initialProps: { search: "" },
    });

    rerender({ search: "Team" });
    expect(result.current.settled).toBe(false);
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.suggestions).toEqual(developers);
  });

  it("resolves to an empty list on a server error", async () => {
    // Positive control mirrors useTitleSuggestions: settle a real result first, then edit to a query that 500s,
    // and assert `[]` while that query is still live (not after rerendering back to a query with a positive
    // result, which would pass even if the failed response were never actually applied) so a hook that never
    // requested anything wouldn't pass trivially.
    const calls = mockApi({
      "GET /api/game-developers": (_call, url) =>
        url.searchParams.get("search") === "Team"
          ? jsonResponse(developers)
          : jsonResponse({ error: "internal_error" }, 500),
    });
    const { result, rerender } = renderHook(({ search }) => useDeveloperSuggestions(search, 10), {
      initialProps: { search: "Team" },
    });
    await waitFor(() => expect(result.current).toEqual({ suggestions: developers, settled: true }));

    rerender({ search: "Zzz" });
    await waitFor(() => expect(calls).toHaveLength(2));
    await flushAsync();

    expect(result.current).toEqual({ suggestions: [], settled: true });
  });

  it("clears the results immediately once the live search text is edited, without waiting for the debounce", async () => {
    mockApi({ "GET /api/game-developers": () => jsonResponse([teamCherry]) });
    const { result, rerender } = renderHook(({ search }) => useDeveloperSuggestions(search, 1000), {
      initialProps: { search: "Team" },
    });
    await waitFor(() => expect(result.current).toEqual({ suggestions: [teamCherry], settled: true }));

    rerender({ search: "Team Cherr" });

    expect(result.current).toEqual({ suggestions: [], settled: false });
  });

  it("ignores a stale response that resolves after a newer request already settled", async () => {
    let resolveTeam!: (response: Response) => void;
    const teamPromise = new Promise<Response>((resolve) => {
      resolveTeam = resolve;
    });
    const calls = mockApi({
      "GET /api/game-developers": (_call, url) =>
        url.searchParams.get("search") === "Team" ? teamPromise : jsonResponse([teamCherry]),
    });
    const { result, rerender } = renderHook(({ search }) => useDeveloperSuggestions(search, 20), {
      initialProps: { search: "Team" },
    });
    await waitFor(() => expect(calls).toHaveLength(1));

    rerender({ search: "Super" });
    await waitFor(() => expect(result.current).toEqual({ suggestions: [teamCherry], settled: true }));

    resolveTeam(jsonResponse(developers));
    await flushAsync();
    expect(result.current).toEqual({ suggestions: [teamCherry], settled: true });
  });
});
