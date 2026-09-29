import { useEffect, type ReactNode } from "react";
import type { GameResponse, PageResponse } from "../../../types/api";
import { PaginationBar } from "../components/PaginationBar";

interface UsePagedGameActionsArgs {
  data: PageResponse<GameResponse> | null;
  loading: boolean;
  page: number;
  setPage: (page: number) => void;
  reload: () => void;
  reloadMeta: () => void;
  setSelected: (game: GameResponse | null) => void;
}

export interface PagedGameActions {
  /** Pagination for the top bar, sharing `GameResultsBar`'s row (no own padding); `null` while there is no page
   *  loaded yet. Right-aligned, like `pagination`. */
  topPagination: ReactNode;
  /** Right-aligned pagination bar below the grid, with its own vertical padding; `null` while there is no page
   *  loaded yet. */
  pagination: ReactNode;
  /** Closes the detail dialog, reloads meta and either steps back a page (the deleted game was the last one of
   *  a later page) or reloads the current page. */
  onDeleted: () => void;
  /** Reloads the current page and meta after a create/update. */
  onUpdated: () => void;
}

/**
 * Shared pagination/reload wiring for `GamesView` and `GamesWatchlistView`: the pagination bar, and the
 * delete/update handlers that keep the grid on a page that actually has items.
 *
 * Beyond the immediate "deleted the last item of a later page" case (handled eagerly in `onDeleted`, without
 * waiting for a request whose result is already known), any reload can leave the current page empty for a
 * reason the caller could not have predicted - e.g. editing the watchlist's only game on page 2 to ownership
 * "owned" takes it off the watchlist entirely. Once such a reload's response comes back empty on a page beyond
 * the first, this steps back to the last page that still has items (`totalPages`, at least 1).
 */
export function usePagedGameActions({
  data,
  loading,
  page,
  setPage,
  reload,
  reloadMeta,
  setSelected,
}: UsePagedGameActionsArgs): PagedGameActions {
  useEffect(() => {
    if (data && data.items.length === 0 && page > 1) setPage(Math.max(1, data.totalPages));
  }, [data, page, setPage]);

  // Both bars share the same page/total/handler; `dense` is the only difference (the top one drops the
  // vertical padding to fit `GameResultsBar`'s row), kept in one place so they can't drift apart.
  const renderPagination = (dense: boolean) =>
    data && (
      <PaginationBar
        page={data.page}
        totalItems={data.totalItems}
        totalPages={data.totalPages}
        onPageChange={setPage}
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
    if (data && data.items.length === 1 && page > 1) setPage(page - 1);
    else reload();
  };

  const onUpdated = () => {
    reload();
    reloadMeta();
  };

  return { topPagination, pagination, onDeleted, onUpdated };
}
