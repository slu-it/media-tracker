import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../../api/client";
import type { BookResponse } from "../../../types/api";
import { listSeriesBooks } from "../api/booksApi";

interface Loaded {
  /** Which (series, reload) request this result belongs to. */
  key: string;
  books: BookResponse[] | null;
  error: string | null;
}

export interface SeriesBooksState {
  /** The series' books in backend order; `null` until the first load. Kept while reloading (no skeleton flash). */
  books: BookResponse[] | null;
  error: string | null;
  reload: () => void;
}

/** Loads the books of one series; refetches when `reloadToken` changes (a save elsewhere) or on `reload()`. */
export function useSeriesBooks(seriesId: string, reloadToken: number, loadErrorText: string): SeriesBooksState {
  const [retryToken, setRetryToken] = useState(0);
  const key = `${seriesId}:${reloadToken}:${retryToken}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: "", books: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    listSeriesBooks(seriesId, controller.signal)
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
  }, [key, seriesId, loadErrorText]);

  const reload = useCallback(() => setRetryToken((n) => n + 1), []);

  return { books: loaded.books, error: loaded.key === key ? loaded.error : null, reload };
}
