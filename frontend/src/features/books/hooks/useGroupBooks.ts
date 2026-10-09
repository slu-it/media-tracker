import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../../api/client";
import type { BookResponse } from "../../../types/api";

interface Loaded {
  /** Which (group, reload) request this result belongs to. */
  key: string;
  books: BookResponse[] | null;
  error: string | null;
}

export interface GroupBooksState {
  /** The group's books in backend order; `null` until the first load. Kept while reloading (no skeleton flash). */
  books: BookResponse[] | null;
  error: string | null;
  reload: () => void;
}

/**
 * Loads the books of one group (a series or an author) via `load`; refetches when `reloadToken` changes (a save
 * elsewhere) or on `reload()`. `load` must be a stable, module-level function: it is an effect dependency, so an
 * inline closure would re-fetch on every render.
 */
export function useGroupBooks(
  groupId: string,
  load: (id: string, signal: AbortSignal) => Promise<BookResponse[]>,
  reloadToken: number,
  loadErrorText: string,
): GroupBooksState {
  const [retryToken, setRetryToken] = useState(0);
  const key = `${groupId}:${reloadToken}:${retryToken}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: "", books: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    load(groupId, controller.signal)
      .then((books) => {
        if (!cancelled) setLoaded({ key, books, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded((prev) => ({ key, books: prev.books, error: errorMessage(error, loadErrorText) }));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, groupId, load, loadErrorText]);

  const reload = useCallback(() => setRetryToken((n) => n + 1), []);

  return { books: loaded.books, error: loaded.key === key ? loaded.error : null, reload };
}
