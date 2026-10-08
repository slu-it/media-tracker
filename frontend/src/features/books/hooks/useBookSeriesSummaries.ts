import { useLoadOnce } from "../../../hooks/useLoadOnce";
import type { BookSeriesSummaryResponse } from "../../../types/api";
import { listBookSeriesSummaries } from "../api/booksApi";

export interface BookSeriesSummariesState {
  summaries: BookSeriesSummaryResponse[] | null;
  error: string | null;
  reload: () => void;
}

/** Loads every series with its book count; `reload()` refetches (after a failure or a book save). */
export function useBookSeriesSummaries(loadErrorText: string): BookSeriesSummariesState {
  const { data, error, reload } = useLoadOnce(listBookSeriesSummaries, loadErrorText);
  return { summaries: data, error, reload };
}
