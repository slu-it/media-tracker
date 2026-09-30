import { useEffect, useRef, useState } from "react";
import { Alert, Button, Fab } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../../types/api";
import { useGamePlatforms } from "../hooks/useGamePlatforms";
import { AddGameDialog } from "./AddGameDialog";
import { GameDetailDialog } from "./GameDetailDialog";

interface GameDialogsHostProps {
  /** The game whose detail dialog is open; `null` closes it. */
  selected: GameResponse | null;
  onSelect: (game: GameResponse | null) => void;
  onCreated: (game: GameResponse) => void;
  onUpdated: (game: GameResponse) => void;
  onDeleted: (id: string) => void;
}

/**
 * FAB + `AddGameDialog` + `GameDetailDialog`, wired to the shared create/edit/delete flow: open the detail dialog
 * on selection, create a game via the FAB, reload the caller's list/meta afterwards. Owns the selectable
 * platforms lookup the two dialogs need, so a page only has to control which game is selected.
 */
export function GameDialogsHost({ selected, onSelect, onCreated, onUpdated, onDeleted }: GameDialogsHostProps) {
  const { t } = useTranslation();
  const { platforms, error: platformsError, reload: reloadPlatforms } = useGamePlatforms(t("errors.loadFailed"));
  const [addOpen, setAddOpen] = useState(false);
  // Read when a save resolves: the dialog may have been closed or switched to another game meanwhile.
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  return (
    <>
      {platformsError && (
        <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={reloadPlatforms}>{t("common.retry")}</Button>}>
          {platformsError}
        </Alert>
      )}

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
        onClose={() => onSelect(null)}
        onSaved={(updated) => {
          if (selectedRef.current?.id === updated.id) onSelect(updated);
          onUpdated(updated);
        }}
        onDeleted={onDeleted}
        platforms={platforms}
      />
      <AddGameDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(game) => {
          setAddOpen(false);
          onCreated(game);
        }}
        platforms={platforms}
      />
    </>
  );
}
