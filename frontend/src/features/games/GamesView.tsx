import { useState } from "react";
import { Alert, Box, Button, Divider } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../types/api";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { GameDialogsHost } from "./components/GameDialogsHost";
import { GameFilterBar } from "./components/GameFilterBar";
import { GameSearchField } from "./components/GameSearchField";
import { GamesGrid } from "./components/GamesGrid";
import { GamesViewHeader } from "./components/GamesViewHeader";
import { SECTION_GAP } from "./components/gamesLayout";
import { EMPTY_FILTERS, filtersKey, hasActiveFilters, type GameFilters } from "./domain/gameFilters";
import { GAMES_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "./domain/gameValues";
import { useGamesMeta } from "./hooks/useGamesMeta";
import { useGamesPage } from "./hooks/useGamesPage";
import { usePagedGameActions } from "./hooks/usePagedGameActions";

interface GamesViewProps {
  /**
   * Debounce delay for the search box. Tests pass a short value to stay on real timers; this prop is the
   * convention for debounced views (copy it for the next media kind) instead of module mocks or fake timers.
   */
  searchDebounceMs?: number;
}

export function GamesView({ searchDebounceMs = SEARCH_DEBOUNCE_MS }: GamesViewProps = {}) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, flushSearch] = useDebouncedValue(searchInput.trim(), searchDebounceMs);
  const [filters, setFilters] = useState<GameFilters>(EMPTY_FILTERS);
  const filtersValue = filtersKey(filters);
  // The page is stored together with the search term and filter selection it was chosen for, so a new term or
  // a filter change evaluates to page 1 in the same render: no reset effect, no redundant request for the stale
  // page. Clearing the search/filters returns to the page that was open before (the stored page belongs to the
  // empty term/filters).
  const [paging, setPaging] = useState({ page: 1, search: "", filters: filtersKey(EMPTY_FILTERS) });
  const page = paging.search === debouncedSearch && paging.filters === filtersValue ? paging.page : 1;
  const setPage = (next: number) => setPaging({ page: next, search: debouncedSearch, filters: filtersValue });
  const { data, loading, error, reload } = useGamesPage(
    page,
    GAMES_PAGE_SIZE,
    debouncedSearch,
    filters,
    t("errors.loadFailed"),
  );
  const { meta, error: metaError, reload: reloadMeta } = useGamesMeta(t("errors.loadFailed"));
  const [selected, setSelected] = useState<GameResponse | null>(null);
  const { topPagination, pagination, onDeleted, onUpdated } = usePagedGameActions({
    data,
    loading,
    page,
    setPage,
    reload,
    reloadMeta,
    setSelected,
  });

  return (
    <Box sx={{ pb: 12 }}>
      <GamesViewHeader
        controls={<GameFilterBar filters={filters} onChange={setFilters} meta={meta} />}
        controlsLayout="fill"
        search={
          <GameSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={() => setSearchInput("")}
            onSubmit={flushSearch}
            fullWidth
          />
        }
        count={data?.totalItems ?? null}
        pagination={topPagination}
      />
      {error && (
        <Alert severity="error" sx={{ mt: SECTION_GAP }} action={<Button onClick={reload}>{t("common.retry")}</Button>}>
          {error}
        </Alert>
      )}
      {metaError && (
        <Alert
          severity="error"
          sx={{ mt: SECTION_GAP }}
          action={<Button onClick={reloadMeta}>{t("common.retry")}</Button>}
        >
          {metaError}
        </Alert>
      )}
      <GameDialogsHost
        selected={selected}
        onSelect={setSelected}
        onCreated={onUpdated}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
      <GamesGrid
        games={data?.items ?? null}
        onOpen={setSelected}
        searchTerm={debouncedSearch}
        filtered={hasActiveFilters(filters)}
      />
      <Divider />
      {pagination}
    </Box>
  );
}
