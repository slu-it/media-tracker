import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../../api/client";
import type { ExpansionResponse } from "../../../types/api";
import { listExpansions } from "../api/expansionsApi";

interface Loaded {
  /** Which (gameId, reload) request this result belongs to. */
  key: string;
  data: ExpansionResponse[] | null;
  error: string | null;
}

export interface ExpansionsState {
  data: ExpansionResponse[] | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads a game's expansions; `reload()` refetches (after create/update/delete/move). The dialog that owns this
 * hook can mount before a game is open, so `gameId` may be `null`/`undefined`, which means "do not fetch".
 */
export function useExpansions(gameId: string | null | undefined, loadErrorText: string): ExpansionsState {
  const [reloadToken, setReloadToken] = useState(0);
  const key = `${gameId ?? ""}:${reloadToken}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: "", data: null, error: null });

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    listExpansions(gameId)
      .then((data) => {
        if (!cancelled) setLoaded({ key, data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded((prev) => ({ key, data: prev.data, error: errorMessage(error, loadErrorText) }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, gameId, loadErrorText]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  // With no game open there is nothing to load, so the idle answer is derived rather than written into state by
  // the effect: the react-hooks preset makes `set-state-in-effect` an error (as in GamesView's page reset).
  const idle = !gameId;
  return {
    data: idle ? null : loaded.data,
    loading: !idle && loaded.key !== key,
    error: idle || loaded.key !== key ? null : loaded.error,
    reload,
  };
}
