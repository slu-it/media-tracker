import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import type { CoverOptionResponse, PageResponse } from "../types/api";

/** The match shape the generic cover picker needs; the id type is the kind's own (games: number). */
export interface CoverMatchLike<Id extends string | number> {
  id: Id;
  name: string;
  releaseYear: number | null;
}

/** The part of a kind's cover-options response the picker reads. */
export interface CoverOptionsLike<Id extends string | number> {
  query: string;
  matches: CoverMatchLike<Id>[];
  selectedMatchId: Id | null;
  covers: PageResponse<CoverOptionResponse>;
}

/**
 * What the hook asks `fetchPage` for. `match` is set only once there is one to send (an explicit pick, or the
 * server's selected match on a later page); `page` is set only on `loadMore()`. The kind's adapter decides how
 * to put `variant` on the wire (games omit the default `static`).
 */
export interface CoverPageRequest<Id extends string | number, V extends string> {
  query: string;
  releaseYear: number | null;
  match?: Id;
  variant: V;
  page?: number;
}

interface Loaded<Id extends string | number> {
  /** Which (query, releaseYear, match, variant, reload) request this result belongs to. */
  key: string;
  /**
   * Bumped on every first-page ("initial") load, independent of `key` (which can repeat, e.g. switching the
   * variant static -> animated -> static). `loadMore()` tags its request with the generation it was issued for
   * and only applies the response while that generation is still current, so a page response for an
   * abandoned load never gets appended to a later, unrelated one that happens to share the same key.
   */
  generation: number;
  /** The first page's response (matches, selectedMatchId); `null` before the first successful load. */
  data: CoverOptionsLike<Id> | null;
  /** Accumulated `items` of every page loaded so far for this key. */
  covers: CoverOptionResponse[];
  /** The most recently loaded page number and the total page count it reported. */
  lastPage: number;
  totalPages: number;
  error: string | null;
  /** Which request produced `error`: the initial load (retryable via `reload()`) or a `loadMore()` call. */
  errorSource: "initial" | "more" | null;
  unavailable: boolean;
  loadingMore: boolean;
}

const EMPTY: Loaded<never> = {
  key: "",
  generation: 0,
  data: null,
  covers: [],
  lastPage: 0,
  totalPages: 0,
  error: null,
  errorSource: null,
  unavailable: false,
  loadingMore: false,
};

export interface CoverOptionsState<Id extends string | number> {
  data: CoverOptionsLike<Id> | null;
  /** Accumulated covers of every page loaded so far. */
  covers: CoverOptionResponse[];
  /** Total covers the server has for the current match, across all pages. */
  totalCovers: number;
  /** Whether a further page exists beyond the ones already loaded. */
  hasMore: boolean;
  loading: boolean;
  /** A `loadMore()` request is in flight. */
  loadingMore: boolean;
  error: string | null;
  /** Which request produced `error`: absent when there is none, otherwise `"initial"` or `"more"`. */
  errorSource: "initial" | "more" | null;
  /** The server answered 503 with the kind's `unavailableCode` (e.g. no API key configured); shown as its own message. */
  unavailable: boolean;
  reload: () => void;
  /** Requests the next page for the current match and appends it; a no-op while loading or when no further page exists. */
  loadMore: () => void;
}

export interface UseCoverOptionsArgs<Id extends string | number, V extends string> {
  query: string;
  releaseYear: number | null;
  /** The explicitly picked match; `null` lets the server rank (and `loadMore` then uses its `selectedMatchId`). */
  match: Id | null;
  /** The kind's variant (games: static/animated); part of the request key, so a change reloads the first page. */
  variant: V;
  /** Performs one request; held in a ref, so an inline function does not retrigger loading. */
  fetchPage: (request: CoverPageRequest<Id, V>) => Promise<CoverOptionsLike<Id>>;
  /** The `error` code of the 503 that means "source not configured" (games: `cover_source_unavailable`). */
  unavailableCode: string;
  loadErrorText: string;
}

/**
 * Loads cover suggestions for a search term; `reload()` retries after a failure, `loadMore()` appends the next
 * page. Modelled on `useExpansions`. A blank `query` makes no request (the backend 400s on it): the picker shows
 * its own hint instead, so this stays a fixed `EMPTY` state.
 */
export function useCoverOptions<Id extends string | number, V extends string>({
  query,
  releaseYear,
  match,
  variant,
  fetchPage,
  unavailableCode,
  loadErrorText,
}: UseCoverOptionsArgs<Id, V>): CoverOptionsState<Id> {
  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });
  const [reloadToken, setReloadToken] = useState(0);
  const trimmedQuery = query.trim();
  const isBlank = trimmedQuery.length === 0;
  const key = `${trimmedQuery}:${releaseYear ?? ""}:${match ?? ""}:${variant}:${reloadToken}`;
  const [loaded, setLoaded] = useState<Loaded<Id>>(EMPTY);
  const generationRef = useRef(0);

  useEffect(() => {
    // The backend 400s on a blank query; the picker shows its own hint instead, so this makes no request. `current`
    // below is derived straight from `isBlank`, so no state update is needed here to reflect that.
    if (isBlank) return;
    let cancelled = false;
    const generation = ++generationRef.current;
    fetchRef
      .current({ query: trimmedQuery, releaseYear, match: match ?? undefined, variant })
      .then((data) => {
        if (!cancelled) {
          setLoaded({
            key,
            generation,
            data,
            covers: data.covers.items,
            lastPage: data.covers.page,
            totalPages: data.covers.totalPages,
            error: null,
            errorSource: null,
            unavailable: false,
            loadingMore: false,
          });
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const unavailable = cause instanceof ApiError && cause.status === 503 && cause.body?.error === unavailableCode;
        // A first-page failure discards whatever the previous key had loaded: leaving it in place would show
        // stale covers under the new variant/query/match, and "Load more" would append onto the wrong list.
        setLoaded({
          key,
          generation,
          data: null,
          covers: [],
          lastPage: 0,
          totalPages: 0,
          error: unavailable ? null : loadErrorText,
          errorSource: unavailable ? null : "initial",
          unavailable,
          loadingMore: false,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [isBlank, key, trimmedQuery, releaseYear, match, variant, unavailableCode, loadErrorText]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  // A blank query never issued a request, so it is never "current": loading/data/etc. all resolve to their
  // empty defaults below without needing a state update to get there.
  const current = !isBlank && loaded.key === key;

  const loadMore = useCallback(() => {
    if (!current || loaded.data === null) return;
    if (loaded.loadingMore || loaded.lastPage >= loaded.totalPages) return;
    const requestGeneration = loaded.generation;
    const nextPage = loaded.lastPage + 1;
    // Absent for a flat source without matches (the server then pages by query alone).
    const selectedMatchId = loaded.data.selectedMatchId ?? undefined;
    setLoaded((prev) => (prev.generation === requestGeneration ? { ...prev, loadingMore: true } : prev));
    fetchRef
      .current({ query: trimmedQuery, releaseYear, match: selectedMatchId, variant, page: nextPage })
      .then((data) => {
        // Only apply while still on the same generation and picking up right after the page this request
        // asked for: a page response arriving after the variant/query/match changed and changed back (a repeated
        // `key`) or after another load-more raced ahead of it must not be appended.
        setLoaded((prev) =>
          prev.generation === requestGeneration && prev.lastPage === nextPage - 1
            ? {
                ...prev,
                covers: [...prev.covers, ...data.covers.items],
                lastPage: data.covers.page,
                totalPages: data.covers.totalPages,
                loadingMore: false,
                error: null,
                errorSource: null,
              }
            : prev,
        );
      })
      .catch(() => {
        setLoaded((prev) =>
          prev.generation === requestGeneration
            ? { ...prev, loadingMore: false, error: loadErrorText, errorSource: "more" }
            : prev,
        );
      });
  }, [current, loaded, trimmedQuery, releaseYear, variant, loadErrorText]);

  return {
    data: current ? loaded.data : null,
    covers: current ? loaded.covers : [],
    totalCovers: current ? (loaded.data?.covers.totalItems ?? 0) : 0,
    hasMore: current && loaded.data !== null && loaded.lastPage < loaded.totalPages,
    loading: !isBlank && !current,
    loadingMore: current && loaded.loadingMore,
    error: current ? loaded.error : null,
    errorSource: current ? loaded.errorSource : null,
    unavailable: current && loaded.unavailable,
    reload,
    loadMore,
  };
}
