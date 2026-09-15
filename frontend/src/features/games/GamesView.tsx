import { useState } from "react";
import { Alert, Box, Button, Divider, Fab } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../types/api";
import { AddGameDialog } from "./components/AddGameDialog";
import { GameDetailDialog } from "./components/GameDetailDialog";
import { GamesGrid } from "./components/GamesGrid";
import { PaginationBar } from "./components/PaginationBar";
import { GAMES_PAGE_SIZE } from "./domain/gameValues";
import { useGamePlatforms } from "./hooks/useGamePlatforms";
import { useGamesPage } from "./hooks/useGamesPage";

export function GamesView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useGamesPage(page, GAMES_PAGE_SIZE, t("errors.loadFailed"));
  const { platforms, error: platformsError, reload: reloadPlatforms } = useGamePlatforms(t("errors.loadFailed"));
  const [selected, setSelected] = useState<GameResponse | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const pagination = data && (
    <PaginationBar
      page={data.page}
      pageSize={data.pageSize}
      totalItems={data.totalItems}
      totalPages={data.totalPages}
      onPageChange={setPage}
      disabled={loading}
    />
  );

  const onDeleted = () => {
    setSelected(null);
    // Removing the last item of a later page: step back instead of showing an empty page.
    if (data && data.items.length === 1 && page > 1) setPage(page - 1);
    else reload();
  };

  return (
    <Box sx={{ pb: 12 }}>
      {pagination}
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
      <GamesGrid games={data?.items ?? null} onOpen={setSelected} />
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
