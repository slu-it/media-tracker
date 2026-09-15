import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../../api/client";
import type { GamePlatformResponse } from "../../../types/api";
import { listGamePlatforms } from "../api/gamesApi";

export interface GamePlatformsState {
  platforms: GamePlatformResponse[] | null;
  error: string | null;
  reload: () => void;
}

/** Loads the selectable platforms once on mount; `reload()` retries after a failure. */
export function useGamePlatforms(loadErrorText: string): GamePlatformsState {
  const [reloadToken, setReloadToken] = useState(0);
  const [platforms, setPlatforms] = useState<GamePlatformResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listGamePlatforms()
      .then((data) => {
        if (!cancelled) {
          setPlatforms(data);
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

  return { platforms, error, reload };
}
