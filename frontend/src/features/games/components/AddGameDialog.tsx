import { useState } from "react";
import { Alert, Typography } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../../../api/client";
import { BaseDialog } from "../../../components/dialog/BaseDialog";
import { DialogActionButton } from "../../../components/dialog/DialogActionButton";
import type { GamePlatformResponse, GameResponse } from "../../../types/api";
import { createGame } from "../api/gamesApi";
import { emptyGameDraft, isDraftValid, toCreateRequest } from "../domain/gameDraft";
import { GAME_DIALOG_HEIGHT } from "./gameDialogLayout";
import { GameForm } from "./GameForm";

interface AddGameDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (game: GameResponse) => void;
  platforms: GamePlatformResponse[] | null;
}

/** Same form as the edit mode, empty, with a save action only. Form state resets every time it opens. */
export function AddGameDialog({ open, onClose, onCreated, platforms }: AddGameDialogProps) {
  if (!open) return null;
  return <AddGameDialogContent onClose={onClose} onCreated={onCreated} platforms={platforms} />;
}

const TITLE_ID = "add-game-title";

function AddGameDialogContent({ onClose, onCreated, platforms }: Omit<AddGameDialogProps, "open">) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(emptyGameDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onCreated(await createGame(toCreateRequest(draft)));
    } catch (cause: unknown) {
      setError(errorMessage(cause, t("errors.saveFailed")));
      setBusy(false);
    }
  };

  const actions = (
    <DialogActionButton
      icon={<SaveIcon />}
      label={t("common.save")}
      color="primary"
      onClick={() => void save()}
      disabled={busy || !isDraftValid(draft)}
    />
  );

  return (
    <BaseDialog
      open
      onClose={onClose}
      actions={actions}
      titleId={TITLE_ID}
      height={GAME_DIALOG_HEIGHT}
      contentScroll="children"
    >
      <Typography id={TITLE_ID} variant="h6" component="h2" sx={{ mb: 2 }}>
        {t("games.addGame")}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <GameForm value={draft} onChange={setDraft} platforms={platforms} disabled={busy} />
    </BaseDialog>
  );
}
