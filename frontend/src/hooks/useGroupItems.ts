import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../api/client";

interface Loaded<T> {
  /** Which (group, reload) request this result belongs to. */
  key: string;
  items: T[] | null;
  error: string | null;
}

export interface GroupItemsState<T> {
  /** The group's items in backend order; `null` until the first load. Kept while reloading (no skeleton flash). */
  items: T[] | null;
  error: string | null;
  reload: () => void;
}

/**
 * Loads the items of one group (a book series or author, a game developer, ...) via `load`; refetches when
 * `reloadToken` changes (a save elsewhere) or on `reload()`. `load` must be a stable, module-level function: it is an
 * effect dependency, so an inline closure would re-fetch on every render.
 */
export function useGroupItems<T>(
  groupId: string,
  load: (id: string, signal: AbortSignal) => Promise<T[]>,
  reloadToken: number,
  loadErrorText: string,
): GroupItemsState<T> {
  const [retryToken, setRetryToken] = useState(0);
  const key = `${groupId}:${reloadToken}:${retryToken}`;
  const [loaded, setLoaded] = useState<Loaded<T>>({ key: "", items: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    load(groupId, controller.signal)
      .then((items) => {
        if (!cancelled) setLoaded({ key, items, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded((prev) => ({ key, items: prev.items, error: errorMessage(error, loadErrorText) }));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, groupId, load, loadErrorText]);

  const reload = useCallback(() => setRetryToken((n) => n + 1), []);

  return { items: loaded.items, error: loaded.key === key ? loaded.error : null, reload };
}
