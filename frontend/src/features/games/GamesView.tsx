import { useState } from "react";
import { Alert, Box, Button, Divider, Fab, Stack } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../types/api";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { AddGameDialog } from "./components/AddGameDialog";
import { GameDetailDialog } from "./components/GameDetailDialog";
import { GameFilterBar } from "./components/GameFilterBar";
import { GameSearchField } from "./components/GameSearchField";
import { GamesGrid } from "./components/GamesGrid";
import { PaginationBar } from "./components/PaginationBar";
import { EMPTY_FILTERS, filtersKey, hasActiveFilters, type GameFilters } from "./domain/gameFilters";
import { GAMES_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "./domain/gameValues";
import { useGamePlatforms } from "./hooks/useGamePlatforms";
import { useGamesMeta } from "./hooks/useGamesMeta";
import { useGamesPage } from "./hooks/useGamesPage";

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
  const { platforms, error: platformsError, reload: reloadPlatforms } = useGamePlatforms(t("errors.loadFailed"));
  const { meta, error: metaError, reload: reloadMeta } = useGamesMeta(t("errors.loadFailed"));
  const [selected, setSelected] = useState<GameResponse | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const pagination = data && (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <PaginationBar
        page={data.page}
        totalItems={data.totalItems}
        totalPages={data.totalPages}
        onPageChange={setPage}
        disabled={loading}
      />
    </Box>
  );

  const onDeleted = () => {
    setSelected(null);
    reloadMeta();
    // Removing the last item of a later page: step back instead of showing an empty page.
    if (data && data.items.length === 1 && page > 1) setPage(page - 1);
    else reload();
  };

  return (
    <Box sx={{ pb: 12 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", minHeight: 64, flexWrap: "wrap", rowGap: 2 }}>
        <GameSearchField
          value={searchInput}
          onChange={setSearchInput}
          onClear={() => setSearchInput("")}
          onSubmit={flushSearch}
        />
        <GameFilterBar filters={filters} onChange={setFilters} meta={meta} />
        <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>{pagination}</Box>
      </Stack>
      <Divider />
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={reload}>{t("common.retry")}</Button>}>
          {error}
        </Alert>
      )}
      {platformsError && (
        <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={reloadPlatforms}>{t("common.retry")}</Button>}>
          {platformsError}
        </Alert>
      )}
      {metaError && (
        <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={reloadMeta}>{t("common.retry")}</Button>}>
          {metaError}
        </Alert>
      )}
      <GamesGrid
        games={data?.items ?? null}
        onOpen={setSelected}
        searchTerm={debouncedSearch}
        filtered={hasActiveFilters(filters)}
      />
      <Divider />
      {pagination}

      <Fab
        color="primary"
        aria-label={t("games.addGame")}
        onClick={() => setAddOpen(true)}
        disabled={platforms === null}
        sx={{ position: "fixed", right: 24, bottom: 24 }}
      >
        <AddIcon />
      </Fab>

      <GameDetailDialog
        game={selected}
        onClose={() => setSelected(null)}
        onSaved={(updated) => {
          setSelected(updated);
          reload();
          reloadMeta();
        }}
        onDeleted={onDeleted}
        platforms={platforms}
      />
      <AddGameDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setAddOpen(false);
          reload();
          reloadMeta();
        }}
        platforms={platforms}
      />
    </Box>
  );
}
