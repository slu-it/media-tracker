import { useLoadOnce } from "../../../hooks/useLoadOnce";
import type { BookTypeResponse } from "../../../types/api";
import { listBookTypes } from "../api/booksApi";

export interface BookTypesState {
  types: BookTypeResponse[] | null;
  error: string | null;
  reload: () => void;
}

/** Loads the selectable book types once on mount; `reload()` retries after a failure. */
export function useBookTypes(loadErrorText: string): BookTypesState {
  const { data, error, reload } = useLoadOnce(listBookTypes, loadErrorText);
  return { types: data, error, reload };
}
