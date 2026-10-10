import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { AddSpeedDial } from "../../../components/media/AddSpeedDial";
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
  /** Usage count per platform id (meta), which decides the presets of the add button. */
  platformCounts?: Record<string, number>;
}

/**
 * Add speed dial + `AddGameDialog` + `GameDetailDialog`, wired to the shared create/edit/delete flow: open the detail dialog
 * on selection, create a game via the speed dial, reload the caller's list/meta afterwards. Owns the selectable
 * platforms lookup the two dialogs need, so a page only has to control which game is selected.
 */
export function GameDialogsHost({
  selected,
  onSelect,
  onCreated,
  onUpdated,
  onDeleted,
  platformCounts,
}: GameDialogsHostProps) {
  const { t } = useTranslation();
  const { platforms, error: platformsError, reload: reloadPlatforms } = useGamePlatforms(t("errors.loadFailed"));
  // `null` while the add dialog is closed; `id` is the preset chosen on the add button.
  const [addPreset, setAddPreset] = useState<{ id?: string } | null>(null);
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

      <AddSpeedDial
        label={t("games.addGame")}
        options={platforms}
        counts={platformCounts}
        onAdd={(id) => setAddPreset({ id })}
      />

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
        open={addPreset !== null}
        onClose={() => setAddPreset(null)}
        onCreated={(game) => {
          setAddPreset(null);
          onCreated(game);
        }}
        platforms={platforms}
        initialPlatformIds={addPreset?.id ? [addPreset.id] : undefined}
      />
    </>
  );
}
