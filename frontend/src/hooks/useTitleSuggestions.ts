import { useEffect, useRef, useState } from "react";
import { useSearchDebounceMs } from "./useSearchDebounceMs";
import { useDebouncedValue } from "./useDebouncedValue";
import { SEARCH_MAX_LENGTH } from "../domain/media/values";

interface Loaded<S> {
  /** Which request key and debounced query this result belongs to, so a response is only shown while current. */
  key: string;
  suggestions: S[];
}

export interface UseTitleSuggestionsOptions<S> {
  /** Performs one request; held in a ref, so an inline function does not retrigger loading. */
  fetchSuggestions: (query: string) => Promise<S[]>;
  /**
   * Part of the effect key: a change (e.g. books switching their cover source) refetches for the same title and
   * hides results fetched under the previous key.
   */
  requestKey: string;
  /** The trimmed title must reach this length before a request fires. */
  minLength: number;
  /** Overrides the context's search debounce (tests). */
  debounceMs?: number;
}

/**
 * Background title suggestions for the add/edit form. Modelled on `useCoverOptions` but much smaller: there is
 * no paging, no reload/loadMore, and any failure (including an unconfigured source) degrades to `[]` instead of
 * surfacing an error, mirroring the backend's own silent degradation.
 *
 * Requests only fire once `enabled` (the caller flips this on the first user edit of the title, so opening an
 * edit form costs no request) and the debounced, trimmed `title` reaches `minLength`.
 */
export function useTitleSuggestions<S>(
  title: string,
  enabled: boolean,
  { fetchSuggestions, requestKey, minLength, debounceMs }: UseTitleSuggestionsOptions<S>,
): S[] {
  const contextDebounceMs = useSearchDebounceMs();
  const [debouncedTitle] = useDebouncedValue(title.trim(), debounceMs ?? contextDebounceMs);
  const [loaded, setLoaded] = useState<Loaded<S> | null>(null);
  const fetchRef = useRef(fetchSuggestions);
  useEffect(() => {
    fetchRef.current = fetchSuggestions;
  });
  const liveTitle = title.trim();
  // `null` below the threshold, above the backend's `SearchTerm.MAX_LENGTH`, disabled, or not yet settled: no
  // request is issued for it, so it never matches `loaded.key` below and the hook falls back to `[]` without a
  // state update, the same trick `useCoverOptions` uses for a blank query.
  //
  // `debouncedTitle === liveTitle` guards against `useDebouncedValue` adopting its first value immediately: right
  // after `enabled` flips true on an edit, `debouncedTitle` can still hold a pre-edit value that never went
  // through the debounce window for *this* render (e.g. the title an edit form opened with). Requiring it to
  // match the live title means a query only fires once it has been stable for the whole debounce window.
  const query =
    enabled &&
    debouncedTitle === liveTitle &&
    debouncedTitle.length >= minLength &&
    debouncedTitle.length <= SEARCH_MAX_LENGTH
      ? debouncedTitle
      : null;

  useEffect(() => {
    if (query === null) return;
    let cancelled = false;
    const key = `${requestKey}\u0000${query}`;
    fetchRef
      .current(query)
      .then((suggestions) => {
        if (!cancelled) setLoaded({ key, suggestions });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, suggestions: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [query, requestKey]);

  // Shown only once the results belong to the *live* (not just the debounced) title: below the threshold, or
  // while the debounce hasn't caught up with a title the user already shortened or changed, this returns `[]`
  // immediately instead of a stale list left over from `loaded`.
  return liveTitle.length >= minLength && loaded?.key === `${requestKey}\u0000${liveTitle}` ? loaded.suggestions : [];
}
