import { useEffect, useState } from "react";
import type { GameDeveloperResponse } from "../../../types/api";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { searchGameDevelopers } from "../api/gamesApi";
import { DEVELOPER_SUGGESTION_MIN_LENGTH, SEARCH_DEBOUNCE_MS } from "../domain/gameValues";

/**
 * Background developer-name suggestions for `DevelopersField`. Modelled on `useTitleSuggestions`: any failure
 * (including a transient network error) degrades to `[]` instead of surfacing an error, and a response is only
 * shown while it still belongs to the current, debounced search text.
 */
interface Loaded {
  /** Which debounced search this result belongs to, so a response is only shown while it is still current. */
  query: string;
  suggestions: GameDeveloperResponse[];
}

export interface DeveloperSuggestions {
  suggestions: GameDeveloperResponse[];
  /**
   * True below the minimum search length (nothing to look up); otherwise true until a response for the live,
   * settled search text has landed. `DevelopersField` uses this to hold off offering to add free text as a new
   * developer until it actually knows no matching suggestion exists - offering it earlier could race a
   * suggestion that arrives moments later.
   */
  settled: boolean;
}

export function useDeveloperSuggestions(search: string, debounceMs: number = SEARCH_DEBOUNCE_MS): DeveloperSuggestions {
  const [debouncedSearch] = useDebouncedValue(search.trim(), debounceMs);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const liveSearch = search.trim();
  // `null` below the minimum length, or not yet settled (`debouncedSearch !== liveSearch`, the same guard
  // `useTitleSuggestions` uses): no request is issued for it, so it never matches `loaded.query` below and the
  // hook falls back to `[]` without a state update.
  const query =
    debouncedSearch === liveSearch && debouncedSearch.length >= DEVELOPER_SUGGESTION_MIN_LENGTH
      ? debouncedSearch
      : null;

  useEffect(() => {
    if (query === null) return;
    let cancelled = false;
    const controller = new AbortController();
    searchGameDevelopers(query, controller.signal)
      .then((data) => {
        if (!cancelled) setLoaded({ query, suggestions: data });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ query, suggestions: [] });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [query]);

  if (liveSearch.length < DEVELOPER_SUGGESTION_MIN_LENGTH) return { suggestions: [], settled: true };
  // Shown only once the results belong to the *live* search text, mirroring `useTitleSuggestions`: while the
  // debounce hasn't caught up with text the user already changed, or its request hasn't resolved yet, this
  // returns `[]` and `settled: false` instead of a stale list left over from `loaded`.
  if (loaded?.query !== liveSearch) return { suggestions: [], settled: false };
  return { suggestions: loaded.suggestions, settled: true };
}
