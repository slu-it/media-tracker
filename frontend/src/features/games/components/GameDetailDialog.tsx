import { useState } from "react";
import { Alert, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import UndoIcon from "@mui/icons-material/Undo";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../../../api/client";
import { BaseDialog } from "../../../components/dialog/BaseDialog";
import { ConfirmDialog } from "../../../components/dialog/ConfirmDialog";
import { DialogActionButton } from "../../../components/dialog/DialogActionButton";
import type { GamePlatformResponse, GameResponse } from "../../../types/api";
import { deleteGame, updateGame } from "../api/gamesApi";
import { draftFromGame, isDraftDirty, isDraftValid, toUpdateRequest } from "../domain/gameDraft";
import { GAME_DIALOG_HEIGHT } from "./gameDialogLayout";
import { GameDetails } from "./GameDetails";
import { GameForm } from "./GameForm";

interface GameDetailDialogProps {
  /** The game to show; `null` closes the dialog. */
  game: GameResponse | null;
  onClose: () => void;
  onSaved: (updated: GameResponse) => void;
  onDeleted: (id: string) => void;
  platforms: GamePlatformResponse[] | null;
}

/** View/edit/delete one game. State lives in the inner component, keyed by game id, so it resets per game. */
export function GameDetailDialog({ game, onClose, onSaved, onDeleted, platforms }: GameDetailDialogProps) {
  if (game === null) return null;
  return (
    <GameDetailDialogContent
      key={game.id}
      game={game}
      onClose={onClose}
      onSaved={onSaved}
      onDeleted={onDeleted}
      platforms={platforms}
    />
  );
}

const TITLE_ID = "game-detail-title";

function GameDetailDialogContent({
  game,
  onClose,
  onSaved,
  onDeleted,
  platforms,
}: Omit<GameDetailDialogProps, "game"> & { game: GameResponse }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState(() => draftFromGame(game));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const startEditing = () => {
    setDraft(draftFromGame(game));
    setError(null);
    setMode("edit");
  };

  const cancelEditing = () => {
    setDraft(draftFromGame(game));
    setError(null);
    setMode("view");
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateGame(game.id, toUpdateRequest(game, draft));
      setDraft(draftFromGame(updated));
      setMode("view");
      onSaved(updated);
    } catch (cause: unknown) {
      setError(errorMessage(cause, t("errors.saveFailed")));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteGame(game.id);
      onDeleted(game.id);
    } catch (cause: unknown) {
      setError(errorMessage(cause, t("errors.deleteFailed")));
      setBusy(false);
    }
  };

  const canSave = !busy && isDraftValid(draft) && isDraftDirty(game, draft);

  const actions = (
    <>
      {mode === "view" ? (
        <DialogActionButton icon={<EditIcon />} label={t("common.edit")} onClick={startEditing} disabled={busy} />
      ) : (
        <>
          <DialogActionButton
            icon={<SaveIcon />}
            label={t("common.save")}
            color="primary"
            onClick={() => void save()}
            disabled={!canSave}
          />
          <DialogActionButton icon={<UndoIcon />} label={t("common.cancel")} onClick={cancelEditing} disabled={busy} />
        </>
      )}
    </>
  );

  const bottomActions = (
    <DialogActionButton
      icon={<DeleteIcon />}
      label={t("common.delete")}
      color="error"
      onClick={() => setConfirmOpen(true)}
      disabled={busy}
    />
  );

  return (
    <BaseDialog
      open
      onClose={onClose}
      actions={actions}
      bottomActions={bottomActions}
      titleId={TITLE_ID}
      height={GAME_DIALOG_HEIGHT}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {mode === "view" ? (
        <GameDetails game={game} titleId={TITLE_ID} />
      ) : (
        <>
          <Typography id={TITLE_ID} variant="h6" component="h2" sx={{ mb: 2 }}>
            {t("games.editGame")}
          </Typography>
          <GameForm value={draft} onChange={setDraft} platforms={platforms} disabled={busy} />
        </>
      )}
      <ConfirmDialog
        open={confirmOpen}
        question={t("games.deleteQuestion", { title: game.title })}
        destructive
        onDecision={(confirmed) => {
          setConfirmOpen(false);
          if (confirmed) void remove();
        }}
      />
    </BaseDialog>
  );
}
