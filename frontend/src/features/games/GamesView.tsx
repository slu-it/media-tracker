import { useState } from "react";
import { Alert, Box, Button, Divider, Fab, Stack } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../types/api";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { AddGameDialog } from "./components/AddGameDialog";
import { GameDetailDialog } from "./components/GameDetailDialog";
import { GameSearchField } from "./components/GameSearchField";
import { GamesGrid } from "./components/GamesGrid";
import { PaginationBar } from "./components/PaginationBar";
import { GAMES_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "./domain/gameValues";
import { useGamePlatforms } from "./hooks/useGamePlatforms";
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
  // The page is stored together with the search term it was chosen for, so a new term evaluates to page 1
  // in the same render: no reset effect, no redundant request for the stale page. Clearing the search returns
  // to the page that was open before searching (the stored page belongs to the empty term).
  const [paging, setPaging] = useState({ page: 1, search: "" });
  const page = paging.search === debouncedSearch ? paging.page : 1;
  const setPage = (next: number) => setPaging({ page: next, search: debouncedSearch });
  const { data, loading, error, reload } = useGamesPage(page, GAMES_PAGE_SIZE, debouncedSearch, t("errors.loadFailed"));
  const { platforms, error: platformsError, reload: reloadPlatforms } = useGamePlatforms(t("errors.loadFailed"));
  const [selected, setSelected] = useState<GameResponse | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const pagination = data && (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <PaginationBar
        page={data.page}
        pageSize={data.pageSize}
        totalItems={data.totalItems}
        totalPages={data.totalPages}
        onPageChange={setPage}
        disabled={loading}
      />
    </Box>
  );

  const onDeleted = () => {
    setSelected(null);
    // Removing the last item of a later page: step back instead of showing an empty page.
    if (data && data.items.length === 1 && page > 1) setPage(page - 1);
    else reload();
  };

  return (
    <Box sx={{ pb: 12 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", minHeight: 64 }}>
        <GameSearchField
          value={searchInput}
          onChange={setSearchInput}
          onClear={() => setSearchInput("")}
          onSubmit={flushSearch}
        />
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
      <GamesGrid games={data?.items ?? null} onOpen={setSelected} searchTerm={debouncedSearch} />
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
        }}
        platforms={platforms}
      />
    </Box>
  );
}
