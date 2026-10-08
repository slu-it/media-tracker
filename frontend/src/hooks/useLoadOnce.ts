import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../api/client";

export interface LoadOnceState<T> {
  data: T | null;
  error: string | null;
  reload: () => void;
}

/**
 * Loads a value once on mount via `load`; `reload()` retries after a failure. A failure surfaces as
 * `loadErrorText` (or the API's message). `load` must be a stable, module-level function: it is an effect
 * dependency, so an inline closure would re-fetch on every render.
 */
export function useLoadOnce<T>(load: () => Promise<T>, loadErrorText: string): LoadOnceState<T> {
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((loaded) => {
        if (!cancelled) {
          setData(loaded);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause, loadErrorText));
      });
    return () => {
      cancelled = true;
    };
  }, [load, reloadToken, loadErrorText]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { data, error, reload };
}
