import { useEffect, useState } from "react";
import type { CoverMatchResponse } from "../../../types/api";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { getTitleSuggestions } from "../api/gamesApi";
import { SEARCH_DEBOUNCE_MS, SEARCH_MAX_LENGTH, TITLE_SUGGESTION_MIN_LENGTH } from "../domain/gameValues";

/**
 * Background title suggestions for the add/edit form. Modelled on `useCoverOptions` but much smaller: there is
 * no paging, no reload/loadMore, and any failure (including an unconfigured source) degrades to `[]` instead of
 * surfacing an error, mirroring the backend's own silent degradation.
 *
 * Requests only fire once `enabled` (the caller flips this on the first user edit of the title, so opening an
 * edit form costs no request) and the debounced, trimmed `title` reaches `TITLE_SUGGESTION_MIN_LENGTH`.
 */
interface Loaded {
  /** Which debounced query this result belongs to, so a response is only shown while it is still current. */
  query: string;
  suggestions: CoverMatchResponse[];
}

export function useTitleSuggestions(
  title: string,
  enabled: boolean,
  debounceMs: number = SEARCH_DEBOUNCE_MS,
): CoverMatchResponse[] {
  const [debouncedTitle] = useDebouncedValue(title.trim(), debounceMs);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const liveTitle = title.trim();
  // `null` below the threshold, above the backend's `SearchTerm.MAX_LENGTH`, disabled, or not yet settled: no
  // request is issued for it, so it never matches `loaded.query` below and the hook falls back to `[]` without a
  // state update, the same trick `useCoverOptions` uses for a blank query.
  //
  // `debouncedTitle === liveTitle` guards against `useDebouncedValue` adopting its first value immediately: right
  // after `enabled` flips true on an edit, `debouncedTitle` can still hold a pre-edit value that never went
  // through the debounce window for *this* render (e.g. the title an edit form opened with). Requiring it to
  // match the live title means a query only fires once it has been stable for the whole debounce window.
  const query =
    enabled &&
    debouncedTitle === liveTitle &&
    debouncedTitle.length >= TITLE_SUGGESTION_MIN_LENGTH &&
    debouncedTitle.length <= SEARCH_MAX_LENGTH
      ? debouncedTitle
      : null;

  useEffect(() => {
    if (query === null) return;
    let cancelled = false;
    getTitleSuggestions(query)
      .then((data) => {
        if (!cancelled) setLoaded({ query, suggestions: data.suggestions });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ query, suggestions: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Shown only once the results belong to the *live* (not just the debounced) title: below the threshold, or
  // while the debounce hasn't caught up with a title the user already shortened or changed, this returns `[]`
  // immediately instead of a stale list left over from `loaded`.
  return liveTitle.length >= TITLE_SUGGESTION_MIN_LENGTH && loaded?.query === liveTitle ? loaded.suggestions : [];
}
