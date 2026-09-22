import { useRef, useState } from "react";
import { Alert, Button, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import SaveIcon from "@mui/icons-material/Save";
import UndoIcon from "@mui/icons-material/Undo";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../../../api/client";
import { BaseDialog } from "../../../components/dialog/BaseDialog";
import { ConfirmDialog } from "../../../components/dialog/ConfirmDialog";
import { DialogActionButton } from "../../../components/dialog/DialogActionButton";
import type { ExpansionResponse, GamePlatformResponse, GameResponse } from "../../../types/api";
import { updateExpansion } from "../api/expansionsApi";
import { deleteGame, updateGame } from "../api/gamesApi";
import { draftFromGame, isDraftDirty, isDraftValid, toUpdateRequest } from "../domain/gameDraft";
import { useExpansions } from "../hooks/useExpansions";
import { ExpansionDialog } from "./ExpansionDialog";
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
  const expansions = useExpansions(game.id, t("errors.loadFailed"));
  const [selectedExpansion, setSelectedExpansion] = useState<ExpansionResponse | null>(null);
  const [addExpansionOpen, setAddExpansionOpen] = useState(false);
  // Optimistic reorder, applied on top of the loaded expansions until a fresh fetch lands. `source` remembers the
  // exact fetched array the ids were derived from (useExpansions hands back a new array per fetch), so the
  // optimistic order is dropped by reference comparison as soon as any newer fetch - a reload after this move, or
  // one triggered elsewhere (e.g. adding or deleting an expansion) - replaces it, instead of comparing content and
  // going stale on a length change.
  const [pendingOrder, setPendingOrder] = useState<{ ids: string[]; source: ExpansionResponse[] } | null>(null);
  const moveInFlightRef = useRef(false);
  const loadedExpansions = expansions.data ?? [];
  const displayedExpansions =
    pendingOrder && pendingOrder.source === loadedExpansions
      ? reorderExpansions(loadedExpansions, pendingOrder.ids)
      : loadedExpansions;

  const moveExpansion = async (expansionId: string, targetIndex: number) => {
    // Two fast drops would each compute their target index against an optimistic order the other has not yet
    // settled, and the two reload responses could then land out of order; ignore further drops until this one
    // has either succeeded (a reload is in flight) or failed.
    if (moveInFlightRef.current) return;
    const activeIndex = displayedExpansions.findIndex((expansion) => expansion.id === expansionId);
    if (activeIndex === -1) return;
    const ids = displayedExpansions.map((expansion) => expansion.id);
    ids.splice(activeIndex, 1);
    ids.splice(targetIndex, 0, expansionId);
    setPendingOrder({ ids, source: loadedExpansions });
    setError(null);
    moveInFlightRef.current = true;
    try {
      await updateExpansion(game.id, expansionId, { sequence: targetIndex });
      expansions.reload();
    } catch (cause: unknown) {
      setPendingOrder(null);
      setError(errorMessage(cause, t("errors.saveFailed")));
    } finally {
      moveInFlightRef.current = false;
    }
  };

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
        <>
          <DialogActionButton icon={<EditIcon />} label={t("common.edit")} onClick={startEditing} disabled={busy} />
          <DialogActionButton
            icon={<PlaylistAddIcon />}
            label={t("games.expansions.add")}
            onClick={() => setAddExpansionOpen(true)}
            disabled={busy}
          />
        </>
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
      contentScroll="children"
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {mode === "view" && expansions.error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={expansions.reload}>
              {t("common.retry")}
            </Button>
          }
        >
          {expansions.error}
        </Alert>
      )}
      {mode === "view" ? (
        <GameDetails
          game={game}
          titleId={TITLE_ID}
          expansions={displayedExpansions}
          onSelectExpansion={setSelectedExpansion}
          onMoveExpansion={(expansionId, targetIndex) => void moveExpansion(expansionId, targetIndex)}
        />
      ) : (
        <>
          <Typography id={TITLE_ID} variant="h6" component="h2" sx={{ mb: 2 }}>
            {t("games.editGame")}
          </Typography>
          <GameForm value={draft} onChange={setDraft} platforms={platforms} disabled={busy} />
        </>
      )}
      <ExpansionDialog
        gameId={game.id}
        expansion={selectedExpansion}
        open={addExpansionOpen || selectedExpansion !== null}
        onClose={() => {
          setAddExpansionOpen(false);
          setSelectedExpansion(null);
        }}
        onChanged={expansions.reload}
      />
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

/** Applies a remembered id order to the expansions it was derived from, dropping any id no longer present. */
function reorderExpansions(expansions: ExpansionResponse[], ids: string[]): ExpansionResponse[] {
  const byId = new Map(expansions.map((expansion) => [expansion.id, expansion]));
  return ids.map((id) => byId.get(id)).filter((expansion): expansion is ExpansionResponse => expansion !== undefined);
}
