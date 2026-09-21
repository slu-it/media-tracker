import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../../api/client";
import type { GameResponse, PageResponse } from "../../../types/api";
import { listGames } from "../api/gamesApi";
import { filtersKey, type GameFilters } from "../domain/gameFilters";

interface Loaded {
  /** Which (page, pageSize, reload, search, filters) request this result belongs to. */
  key: string;
  data: PageResponse<GameResponse> | null;
  error: string | null;
}

export interface GamesPageState {
  /** The current page, or the previous one while a new page loads (no grid flash). */
  data: PageResponse<GameResponse> | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Loads one page of games; `reload()` refetches the same page (after create/update/delete). */
export function useGamesPage(
  page: number,
  pageSize: number,
  search: string,
  filters: GameFilters,
  loadErrorText: string,
): GamesPageState {
  const [reloadToken, setReloadToken] = useState(0);
  // `filtersKey` rather than the object, so the same selection made in a different order is the same request.
  const filterKey = filtersKey(filters);
  // `search` and `filterKey` last: they change independently of page/pageSize/reload and should not shadow those.
  const key = `${page}:${pageSize}:${reloadToken}:${search}:${filterKey}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: "", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    listGames(page, pageSize, search, filters)
      .then((data) => {
        if (!cancelled) setLoaded({ key, data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded((prev) => ({ key, data: prev.data, error: errorMessage(error, loadErrorText) }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, page, pageSize, search, filters, loadErrorText]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { data: loaded.data, loading: loaded.key !== key, error: loaded.key === key ? loaded.error : null, reload };
}
