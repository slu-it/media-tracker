import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { flushAsync } from "../test/flushAsync";
import { useTitleSuggestions } from "./useTitleSuggestions";

interface Suggestion {
  id: number;
  name: string;
}

const hollow: Suggestion[] = [{ id: 1, name: "Hollow Knight" }];
const MIN = 5;

function options(fetchSuggestions: (query: string) => Promise<Suggestion[]>, debounceMs: number, requestKey = "k") {
  return { fetchSuggestions, requestKey, minLength: MIN, debounceMs };
}

describe("useTitleSuggestions", () => {
  it("makes no request while the debounced title is under the minimum length", async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue(hollow);
    const { result } = renderHook(() => useTitleSuggestions("Hade", true, options(fetchSuggestions, 10)));

    await flushAsync();
    expect(fetchSuggestions).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it("makes no request while not enabled", async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue(hollow);
    const { result } = renderHook(() => useTitleSuggestions("Hollow Knight", false, options(fetchSuggestions, 10)));

    await flushAsync();
    expect(fetchSuggestions).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it("fires a single debounced request once typing settles", async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue(hollow);
    // `useDebouncedValue` adopts its very first value immediately, so mounting already at/above the threshold
    // would fire an extra request for that initial value; starting below it keeps this test to the one, settled
    // request a burst of edits should produce.
    const { result, rerender } = renderHook(
      ({ title }) => useTitleSuggestions(title, true, options(fetchSuggestions, 20)),
      { initialProps: { title: "Holl" } },
    );
    rerender({ title: "Hollow" });
    rerender({ title: "Hollow K" });

    await waitFor(() => expect(result.current).toEqual(hollow));
    expect(fetchSuggestions).toHaveBeenCalledExactlyOnceWith("Hollow K");
  });

  it("refetches the same title and hides the old results when the request key changes", async () => {
    const fetchSuggestions = vi.fn<(query: string) => Promise<Suggestion[]>>().mockResolvedValue(hollow);
    const { result, rerender } = renderHook(
      ({ requestKey }) => useTitleSuggestions("Hollow Knight", true, options(fetchSuggestions, 10, requestKey)),
      { initialProps: { requestKey: "book" } },
    );
    await waitFor(() => expect(result.current).toEqual(hollow));
    expect(fetchSuggestions).toHaveBeenCalledTimes(1);

    const audio: Suggestion[] = [{ id: 2, name: "Hollow Knight (audio)" }];
    fetchSuggestions.mockResolvedValue(audio);
    rerender({ requestKey: "audiobook" });

    // Results fetched under the previous key are not shown for the new one.
    expect(result.current).toEqual([]);
    await waitFor(() => expect(result.current).toEqual(audio));
    expect(fetchSuggestions).toHaveBeenCalledTimes(2);
    expect(fetchSuggestions).toHaveBeenLastCalledWith("Hollow Knight");
  });

  it("does not refetch when only the fetch function identity changes", async () => {
    const first = vi.fn().mockResolvedValue(hollow);
    const second = vi.fn().mockResolvedValue(hollow);
    const { result, rerender } = renderHook(
      ({ fetchSuggestions }) => useTitleSuggestions("Hollow Knight", true, options(fetchSuggestions, 10)),
      { initialProps: { fetchSuggestions: first } },
    );
    await waitFor(() => expect(result.current).toEqual(hollow));

    rerender({ fetchSuggestions: second });

    await flushAsync();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("resolves to an empty list on a failed request", async () => {
    // `result.current` starts out as `[]`, so a hook that never actually requested anything would pass a naive
    // version of this test just as well: first settle a real, successful result for "Hollow Knight", then edit
    // to "Celeste" and have that request fail. Rerendering back to "Hollow Knight" afterwards and asserting `[]`
    // *immediately* (no `waitFor`) is the part that actually pins the error handling: `loaded.key` only still
    // reads "Hollow Knight" there if the failure was never turned into a `setLoaded` call, in which case the
    // stale, successful suggestions from the first request would resurface.
    const fetchSuggestions = vi.fn((query: string) =>
      query === "Hollow Knight" ? Promise.resolve(hollow) : Promise.reject(new Error("boom")),
    );
    const { result, rerender } = renderHook(
      ({ title }) => useTitleSuggestions(title, true, options(fetchSuggestions, 10)),
      { initialProps: { title: "Hollow Knight" } },
    );
    await waitFor(() => expect(result.current).toEqual(hollow));

    rerender({ title: "Celeste" });
    await waitFor(() => expect(fetchSuggestions).toHaveBeenCalledTimes(2));
    // Let the failure actually resolve and be handled before rerendering back, so the immediate assertion
    // below is not just racing an in-flight request.
    await flushAsync();

    rerender({ title: "Hollow Knight" });
    expect(result.current).toEqual([]);
  });

  it("drops the results once the term is edited back under the minimum length", async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue(hollow);
    const { result, rerender } = renderHook(
      ({ title }) => useTitleSuggestions(title, true, options(fetchSuggestions, 10)),
      { initialProps: { title: "Hollow Knight" } },
    );
    await waitFor(() => expect(result.current).toEqual(hollow));

    rerender({ title: "Ho" });

    await waitFor(() => expect(result.current).toEqual([]));
  });

  it("clears the results immediately once the live title drops under the minimum, without waiting for the debounce", async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue(hollow);
    // A long debounce keeps `debouncedTitle` at "Hollow Knight" well past the rerender below, isolating the
    // immediate, live-title-driven clear from the (separately covered) debounced one.
    const { result, rerender } = renderHook(
      ({ title }) => useTitleSuggestions(title, true, options(fetchSuggestions, 1000)),
      { initialProps: { title: "Hollow Knight" } },
    );
    await waitFor(() => expect(result.current).toEqual(hollow));

    rerender({ title: "Ho" });

    expect(result.current).toEqual([]);
  });

  it("makes no request for a title over the backend's maximum length", async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue(hollow);
    const { result } = renderHook(() => useTitleSuggestions("x".repeat(201), true, options(fetchSuggestions, 10)));

    await flushAsync();
    expect(fetchSuggestions).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it("never requests the pre-edit title when enabled flips true on the same edit that changes it", async () => {
    // `useDebouncedValue` adopts its first value immediately, so mounting disabled at "Celeste" already leaves
    // `debouncedTitle` at "Celeste". If `enabled` flipping true fired for whatever `debouncedTitle` currently
    // holds, this rerender would fire an undebounced request for the stale "Celeste" alongside the settled one
    // for "Hollow Knight". Asserting there is exactly one call, for the new title, is the positive control that
    // proves the hook did fetch, just never for the stale value.
    const fetchSuggestions = vi.fn().mockResolvedValue(hollow);
    const { rerender } = renderHook(
      ({ title, enabled }) => useTitleSuggestions(title, enabled, options(fetchSuggestions, 10)),
      { initialProps: { title: "Celeste", enabled: false } },
    );

    rerender({ title: "Hollow Knight", enabled: true });

    await waitFor(() => expect(fetchSuggestions).toHaveBeenCalledTimes(1));
    expect(fetchSuggestions).toHaveBeenCalledWith("Hollow Knight");
  });

  it("ignores a stale response that resolves after a newer request already settled", async () => {
    let resolveHollow!: (value: Suggestion[]) => void;
    const hollowPromise = new Promise<Suggestion[]>((resolve) => {
      resolveHollow = resolve;
    });
    const celeste: Suggestion[] = [{ id: 2, name: "Celeste" }];
    const fetchSuggestions = vi.fn((query: string) => (query === "Hollow" ? hollowPromise : Promise.resolve(celeste)));
    const { result, rerender } = renderHook(
      ({ title }) => useTitleSuggestions(title, true, { ...options(fetchSuggestions, 20), minLength: 3 }),
      { initialProps: { title: "Hollow" } },
    );
    await waitFor(() => expect(fetchSuggestions).toHaveBeenCalledTimes(1));

    rerender({ title: "Celeste" });
    await waitFor(() => expect(result.current).toEqual(celeste));

    resolveHollow(hollow);
    await flushAsync();
    expect(result.current).toEqual(celeste);
  });
});
