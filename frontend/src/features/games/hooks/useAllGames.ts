import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../../api/client";
import type { GameResponse, GameSort } from "../../../types/api";
import { listAllGames } from "../api/gamesApi";
import { filtersKey, type GameFilters } from "../domain/gameFilters";

interface Loaded {
  /** Which (reload, search, filters, sort, rated) request this result belongs to. */
  key: string;
  items: GameResponse[] | null;
  error: string | null;
}

export interface AllGamesState {
  /** Every matching game, across all pages; the previous result while a new one loads (no flash). */
  items: GameResponse[] | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads every game matching `search`/`filters`/`sort`/`rated` at once (via `listAllGames`), for a full result set
 * at once (e.g. an export) rather than one grid page. Mirrors `useGamesPage`'s stale-response handling: a
 * superseded request's response is ignored, and the previous items stay visible while a new request is in flight.
 */
export function useAllGames(
  search: string,
  filters: GameFilters,
  loadErrorText: string,
  sort?: GameSort,
  rated?: boolean,
): AllGamesState {
  const [reloadToken, setReloadToken] = useState(0);
  // `filtersKey` rather than the object, so the same selection made in a different order is the same request.
  const filterKey = filtersKey(filters);
  const key = `${reloadToken}:${search}:${filterKey}:${sort ?? ""}:${rated ? "1" : "0"}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: "", items: null, error: null });

  useEffect(() => {
    let cancelled = false;
    listAllGames(search, filters, sort, rated, { isCancelled: () => cancelled })
      .then((items) => {
        if (!cancelled) setLoaded({ key, items, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded((prev) => ({ key, items: prev.items, error: errorMessage(error, loadErrorText) }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, search, filters, sort, rated, loadErrorText]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return {
    items: loaded.items,
    loading: loaded.key !== key,
    error: loaded.key === key ? loaded.error : null,
    reload,
  };
}
