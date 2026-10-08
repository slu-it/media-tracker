import { useLoadOnce } from "../../../hooks/useLoadOnce";
import type { BookMetaResponse } from "../../../types/api";
import { getBooksMeta } from "../api/booksApi";

export interface BooksMetaState {
  meta: BookMetaResponse | null;
  error: string | null;
  reload: () => void;
}

/** Loads the filterable values once on mount; `reload()` retries after a failure. */
export function useBooksMeta(loadErrorText: string): BooksMetaState {
  const { data, error, reload } = useLoadOnce(getBooksMeta, loadErrorText);
  return { meta: data, error, reload };
}
