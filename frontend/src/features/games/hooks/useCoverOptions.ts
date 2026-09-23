import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/client";
import type { CoverOptionResponse, CoverOptionsResponse, CoverType } from "../../../types/api";
import { getCoverOptions } from "../api/gamesApi";
import { DEFAULT_COVER_TYPE } from "../domain/coverTypes";

/** Omitted when it is the backend's own default, so a default request needs no `type=`/`page=` in its URL. */
function typeParam(type: CoverType): CoverType | undefined {
  return type === DEFAULT_COVER_TYPE ? undefined : type;
}

interface Loaded {
  /** Which (gameId, query, match, type, reload) request this result belongs to. */
  key: string;
  /**
   * Bumped on every first-page ("initial") load, independent of `key` (which can repeat, e.g. switching the
   * type static -> animated -> static). `loadMore()` tags its request with the generation it was issued for
   * and only applies the response while that generation is still current, so a page response for an
   * abandoned load never gets appended to a later, unrelated one that happens to share the same key.
   */
  generation: number;
  /** The first page's response (matches, selectedMatchId, type); `null` before the first successful load. */
  data: CoverOptionsResponse | null;
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

const EMPTY: Loaded = {
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

export interface CoverOptionsState {
  data: CoverOptionsResponse | null;
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
  /** The server has no SteamGridDB key configured (503 `cover_source_unavailable`); shown as its own message. */
  unavailable: boolean;
  reload: () => void;
  /** Requests the next page for the current match and appends it; a no-op while loading or without a match. */
  loadMore: () => void;
}

/**
 * Loads cover suggestions for a game; `reload()` retries after a failure, `loadMore()` appends the next page.
 * Modelled on `useExpansions`, except the dialog that owns this hook only ever mounts its content for an
 * already-open game, so `gameId` is never `null`.
 */
export function useCoverOptions(
  gameId: string,
  query: string,
  match: number | null,
  type: CoverType,
  loadErrorText: string,
): CoverOptionsState {
  const [reloadToken, setReloadToken] = useState(0);
  const key = `${gameId}:${query}:${match ?? ""}:${type}:${reloadToken}`;
  const [loaded, setLoaded] = useState<Loaded>(EMPTY);
  const generationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const generation = ++generationRef.current;
    getCoverOptions(gameId, { query, match: match ?? undefined, type: typeParam(type) })
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
        const unavailable =
          cause instanceof ApiError && cause.status === 503 && cause.body?.error === "cover_source_unavailable";
        // A first-page failure discards whatever the previous key had loaded: leaving it in place would show
        // stale covers under the new type/query/match, and "Load more" would append onto the wrong list.
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
  }, [key, gameId, query, match, type, loadErrorText]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const current = loaded.key === key;

  const loadMore = useCallback(() => {
    if (!current || loaded.data === null || loaded.data.selectedMatchId === null) return;
    if (loaded.loadingMore || loaded.lastPage >= loaded.totalPages) return;
    const requestGeneration = loaded.generation;
    const nextPage = loaded.lastPage + 1;
    const selectedMatchId = loaded.data.selectedMatchId;
    setLoaded((prev) => (prev.generation === requestGeneration ? { ...prev, loadingMore: true } : prev));
    getCoverOptions(gameId, { query, match: selectedMatchId, type: typeParam(type), page: nextPage })
      .then((data) => {
        // Only apply while still on the same generation and picking up right after the page this request
        // asked for: a page response arriving after the type/query/match changed and changed back (a repeated
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
  }, [current, loaded, gameId, query, type, loadErrorText]);

  return {
    data: current ? loaded.data : null,
    covers: current ? loaded.covers : [],
    totalCovers: current ? (loaded.data?.covers.totalItems ?? 0) : 0,
    hasMore: current && loaded.data !== null && loaded.lastPage < loaded.totalPages,
    loading: !current,
    loadingMore: current && loaded.loadingMore,
    error: current ? loaded.error : null,
    errorSource: current ? loaded.errorSource : null,
    unavailable: current && loaded.unavailable,
    reload,
    loadMore,
  };
}
