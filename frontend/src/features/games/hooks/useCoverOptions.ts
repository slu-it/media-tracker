import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../api/client";
import type { CoverOptionsResponse } from "../../../types/api";
import { getCoverOptions } from "../api/gamesApi";

interface Loaded {
  /** Which (gameId, query, match, reload) request this result belongs to. */
  key: string;
  data: CoverOptionsResponse | null;
  error: string | null;
  unavailable: boolean;
}

export interface CoverOptionsState {
  data: CoverOptionsResponse | null;
  loading: boolean;
  error: string | null;
  /** The server has no SteamGridDB key configured (503 `cover_source_unavailable`); shown as its own message. */
  unavailable: boolean;
  reload: () => void;
}

/**
 * Loads cover suggestions for a game; `reload()` retries after a failure. Modelled on `useExpansions`, except the
 * dialog that owns this hook only ever mounts its content for an already-open game, so `gameId` is never `null`.
 */
export function useCoverOptions(
  gameId: string,
  query: string,
  match: number | null,
  loadErrorText: string,
): CoverOptionsState {
  const [reloadToken, setReloadToken] = useState(0);
  const key = `${gameId}:${query}:${match ?? ""}:${reloadToken}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: "", data: null, error: null, unavailable: false });

  useEffect(() => {
    let cancelled = false;
    getCoverOptions(gameId, { query, match: match ?? undefined })
      .then((data) => {
        if (!cancelled) setLoaded({ key, data, error: null, unavailable: false });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const unavailable =
          cause instanceof ApiError && cause.status === 503 && cause.body?.error === "cover_source_unavailable";
        setLoaded((prev) => ({
          key,
          data: prev.data,
          error: unavailable ? null : loadErrorText,
          unavailable,
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, gameId, query, match, loadErrorText]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const current = loaded.key === key;
  return {
    data: loaded.data,
    loading: loaded.key !== key,
    error: current ? loaded.error : null,
    unavailable: current && loaded.unavailable,
    reload,
  };
}
