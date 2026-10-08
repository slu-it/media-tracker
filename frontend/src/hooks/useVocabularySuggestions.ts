import { useEffect, useState } from "react";
import { VOCABULARY_SUGGESTION_MIN_LENGTH } from "../domain/media/values";
import type { NamedEntry } from "../domain/media/vocabularyDraft";
import { useSearchDebounceMs } from "./useSearchDebounceMs";
import { useDebouncedValue } from "./useDebouncedValue";

/**
 * Background vocabulary-name suggestions (developers, authors) for the chip input fields. Modelled on `useTitleSuggestions`: any failure
 * (including a transient network error) degrades to `[]` instead of surfacing an error, and a response is only
 * shown while it still belongs to the current, debounced search text.
 */
interface Loaded<E extends NamedEntry> {
  /** Which debounced search this result belongs to, so a response is only shown while it is still current. */
  query: string;
  suggestions: E[];
}

export interface VocabularySuggestions<E extends NamedEntry> {
  suggestions: E[];
  /**
   * True below the minimum search length (nothing to look up); otherwise true until a response for the live,
   * settled search text has landed. The field uses this to hold off offering to add free text as a new
   * entry until it actually knows no matching suggestion exists - offering it earlier could race a
   * suggestion that arrives moments later.
   */
  settled: boolean;
}

/**
 * `fetcher` must be a stable (module-level) function: it is an effect dependency, so an inline closure would
 * re-fetch on every render.
 */
export function useVocabularySuggestions<E extends NamedEntry>(
  search: string,
  fetcher: (term: string, signal: AbortSignal) => Promise<E[]>,
  debounceMs?: number,
): VocabularySuggestions<E> {
  const contextDebounceMs = useSearchDebounceMs();
  const [debouncedSearch] = useDebouncedValue(search.trim(), debounceMs ?? contextDebounceMs);
  const [loaded, setLoaded] = useState<Loaded<E> | null>(null);
  const liveSearch = search.trim();
  // `null` below the minimum length, or not yet settled (`debouncedSearch !== liveSearch`, the same guard
  // `useTitleSuggestions` uses): no request is issued for it, so it never matches `loaded.query` below and the
  // hook falls back to `[]` without a state update.
  const query =
    debouncedSearch === liveSearch && debouncedSearch.length >= VOCABULARY_SUGGESTION_MIN_LENGTH
      ? debouncedSearch
      : null;

  useEffect(() => {
    if (query === null) return;
    let cancelled = false;
    const controller = new AbortController();
    fetcher(query, controller.signal)
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
  }, [query, fetcher]);

  if (liveSearch.length < VOCABULARY_SUGGESTION_MIN_LENGTH) return { suggestions: [], settled: true };
  // Shown only once the results belong to the *live* search text, mirroring `useTitleSuggestions`: while the
  // debounce hasn't caught up with text the user already changed, or its request hasn't resolved yet, this
  // returns `[]` and `settled: false` instead of a stale list left over from `loaded`.
  if (loaded?.query !== liveSearch) return { suggestions: [], settled: false };
  return { suggestions: loaded.suggestions, settled: true };
}
