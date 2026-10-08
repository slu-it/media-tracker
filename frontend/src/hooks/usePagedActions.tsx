import { useEffect, type ReactNode } from "react";
import type { PageResponse } from "../types/api";
import { PaginationBar } from "../components/media/PaginationBar";

interface UsePagedActionsArgs<T> {
  data: PageResponse<T> | null;
  loading: boolean;
  page: number;
  /** `replace` marks an automatic correction: the view must not add a history entry for it. */
  setPage: (page: number, options?: { replace?: boolean }) => void;
  reload: () => void;
  reloadMeta: () => void;
  setSelected: (item: T | null) => void;
}

export interface PagedActions {
  /** Pagination for the top bar, sharing `ResultsBar`'s row (no own padding); `null` while there is no page
   *  loaded yet. Right-aligned, like `pagination`. */
  topPagination: ReactNode;
  /** Right-aligned pagination bar below the grid, with its own vertical padding; `null` while there is no page
   *  loaded yet. */
  pagination: ReactNode;
  /** Closes the detail dialog, reloads meta and either steps back a page (the deleted item was the last one of
   *  a later page) or reloads the current page. */
  onDeleted: () => void;
  /** Reloads the current page and meta after a create/update. */
  onUpdated: () => void;
}

/**
 * Shared pagination/reload wiring for the paged media views (`GamesView`, `GamesWatchlistView`, ...): the pagination bar, and the
 * delete/update handlers that keep the grid on a page that actually has items.
 *
 * Beyond the immediate "deleted the last item of a later page" case (handled eagerly in `onDeleted`, without
 * waiting for a request whose result is already known), any reload can leave the current page empty for a
 * reason the caller could not have predicted - e.g. editing the watchlist's only game on page 2 to ownership
 * "owned" takes it off the watchlist entirely. Once such a reload's response comes back empty on a page beyond
 * the first, this steps back to the last page that still has items (`totalPages`, at least 1).
 */
export function usePagedActions<T>({
  data,
  loading,
  page,
  setPage,
  reload,
  reloadMeta,
  setSelected,
}: UsePagedActionsArgs<T>): PagedActions {
  // `data` is the previous request's page while the next one loads, so only a settled response for the current
  // page may trigger the correction; stale data would overwrite a history entry (e.g. after Back).
  useEffect(() => {
    if (!loading && data && data.page === page && data.items.length === 0 && page > 1) {
      setPage(Math.max(1, data.totalPages), { replace: true });
    }
  }, [data, loading, page, setPage]);

  // Both bars share the same page/total/handler; `dense` is the only difference (the top one drops the
  // vertical padding to fit `ResultsBar`'s row), kept in one place so they can't drift apart.
  const renderPagination = (dense: boolean) =>
    data && (
      <PaginationBar
        page={data.page}
        totalItems={data.totalItems}
        totalPages={data.totalPages}
        onPageChange={(next) => setPage(next)}
        disabled={loading}
        dense={dense}
      />
    );

  const topPagination = renderPagination(true);
  const pagination = renderPagination(false);

  const onDeleted = () => {
    setSelected(null);
    reloadMeta();
    // Removing the last item of a later page: step back instead of showing an empty page.
    if (data && data.items.length === 1 && page > 1) setPage(page - 1, { replace: true });
    else reload();
  };

  const onUpdated = () => {
    reload();
    reloadMeta();
  };

  return { topPagination, pagination, onDeleted, onUpdated };
}
