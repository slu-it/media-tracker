import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../../api/client";
import type { BookResponse, PageResponse } from "../../../types/api";
import { listBooks } from "../api/booksApi";
import { bookFiltersKey, type BookFilters } from "../domain/bookFilters";

interface Loaded {
  /** Which (page, pageSize, reload, search, filters) request this result belongs to. */
  key: string;
  data: PageResponse<BookResponse> | null;
  error: string | null;
}

export interface BooksPageState {
  /** The current page, or the previous one while a new page loads (no grid flash). */
  data: PageResponse<BookResponse> | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Loads one page of books; `reload()` refetches the same page (after create/update/delete). */
export function useBooksPage(
  page: number,
  pageSize: number,
  search: string,
  filters: BookFilters,
  loadErrorText: string,
): BooksPageState {
  const [reloadToken, setReloadToken] = useState(0);
  // `bookFiltersKey` rather than the object, so the same selection made in a different order is the same request.
  const filterKey = bookFiltersKey(filters);
  const key = `${page}:${pageSize}:${reloadToken}:${search}:${filterKey}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: "", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    listBooks(page, pageSize, search, filters)
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
