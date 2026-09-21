import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../../api/client";
import type { GameMetaResponse } from "../../../types/api";
import { getGamesMeta } from "../api/gamesApi";

export interface GamesMetaState {
  meta: GameMetaResponse | null;
  error: string | null;
  reload: () => void;
}

/** Loads the filterable values once on mount; `reload()` retries after a failure. */
export function useGamesMeta(loadErrorText: string): GamesMetaState {
  const [reloadToken, setReloadToken] = useState(0);
  const [meta, setMeta] = useState<GameMetaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGamesMeta()
      .then((data) => {
        if (!cancelled) {
          setMeta(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause, loadErrorText));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, loadErrorText]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { meta, error, reload };
}
