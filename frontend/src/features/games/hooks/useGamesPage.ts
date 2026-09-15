import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../../api/client";
import type { GameResponse, PageResponse } from "../../../types/api";
import { listGames } from "../api/gamesApi";

interface Loaded {
  /** Which (page, pageSize, reload) request this result belongs to. */
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
export function useGamesPage(page: number, pageSize: number, loadErrorText: string): GamesPageState {
  const [reloadToken, setReloadToken] = useState(0);
  const key = `${page}:${pageSize}:${reloadToken}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: "", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    listGames(page, pageSize)
      .then((data) => {
        if (!cancelled) setLoaded({ key, data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded((prev) => ({ key, data: prev.data, error: errorMessage(error, loadErrorText) }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, page, pageSize, loadErrorText]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { data: loaded.data, loading: loaded.key !== key, error: loaded.key === key ? loaded.error : null, reload };
}
