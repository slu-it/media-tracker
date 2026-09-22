import { useState } from "react";
import { Alert, Stack, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import UndoIcon from "@mui/icons-material/Undo";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../../../api/client";
import { BaseDialog } from "../../../components/dialog/BaseDialog";
import { ConfirmDialog } from "../../../components/dialog/ConfirmDialog";
import { DialogActionButton } from "../../../components/dialog/DialogActionButton";
import type { ExpansionResponse } from "../../../types/api";
import { createExpansion, deleteExpansion, updateExpansion } from "../api/expansionsApi";
import {
  draftFromExpansion,
  emptyExpansionDraft,
  isDraftDirty,
  isDraftValid,
  toCreateRequest,
  toUpdateRequest,
  type ExpansionDraft,
} from "../domain/expansionDraft";
import { GameTitleField } from "./fields/GameTitleField";
import { OwnershipField } from "./fields/OwnershipField";
import { ProgressField } from "./fields/ProgressField";
import { EXPANSION_DIALOG_HEIGHT } from "./gameDialogLayout";

interface ExpansionDialogProps {
  gameId: string;
  /** null opens the dialog in "add" mode; an expansion opens it in "view" mode. */
  expansion: ExpansionResponse | null;
  open: boolean;
  onClose: () => void;
  /** Called after a successful create, update or delete so the caller can reload its list. */
  onChanged: () => void;
}

/** View/edit/delete one expansion, or add a new one. A smaller sibling of GameDetailDialog/AddGameDialog. */
export function ExpansionDialog({ gameId, expansion, open, onClose, onChanged }: ExpansionDialogProps) {
  if (!open) return null;
  return (
    <ExpansionDialogContent
      key={expansion?.id ?? "add"}
      gameId={gameId}
      expansion={expansion}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

const TITLE_ID = "expansion-dialog-title";

type Mode = "add" | "view" | "edit";

function ExpansionDialogContent({ gameId, expansion, onClose, onChanged }: Omit<ExpansionDialogProps, "open">) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>(expansion === null ? "add" : "view");
  const [draft, setDraft] = useState<ExpansionDraft>(() =>
    expansion === null ? emptyExpansionDraft() : draftFromExpansion(expansion),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The `expansion` prop is a snapshot the parent captured when this dialog was opened and never refreshes; a
  // successful update is kept here so view mode (and isDraftDirty below) reflect what was actually saved instead
  // of going stale. Reset per expansion via the `key` on ExpansionDialog, same as draft/mode/etc above.
  const [current, setCurrent] = useState(expansion);

  const startEditing = () => {
    if (current) setDraft(draftFromExpansion(current));
    setError(null);
    setMode("edit");
  };

  const cancelEditing = () => {
    if (current) setDraft(draftFromExpansion(current));
    setError(null);
    setMode("view");
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (current === null) {
        await createExpansion(gameId, toCreateRequest(draft));
        onChanged();
        onClose();
      } else {
        const updated = await updateExpansion(gameId, current.id, toUpdateRequest(current, draft));
        setCurrent(updated);
        onChanged();
        setMode("view");
      }
    } catch (cause: unknown) {
      setError(errorMessage(cause, t("errors.saveFailed")));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (current === null) return;
    setBusy(true);
    setError(null);
    try {
      await deleteExpansion(gameId, current.id);
      onChanged();
      onClose();
    } catch (cause: unknown) {
      setError(errorMessage(cause, t("errors.deleteFailed")));
      setBusy(false);
    }
  };

  const canSave = !busy && isDraftValid(draft) && (current === null || isDraftDirty(current, draft));

  const actions =
    mode === "view" ? (
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
        <DialogActionButton
          icon={<UndoIcon />}
          label={t("common.cancel")}
          onClick={mode === "edit" ? cancelEditing : onClose}
          disabled={busy}
        />
      </>
    );

  const bottomActions =
    mode === "view" ? (
      <DialogActionButton
        icon={<DeleteIcon />}
        label={t("common.delete")}
        color="error"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
      />
    ) : undefined;

  return (
    <BaseDialog
      open
      onClose={onClose}
      actions={actions}
      bottomActions={bottomActions}
      titleId={TITLE_ID}
      maxWidth="xs"
      height={EXPANSION_DIALOG_HEIGHT}
    >
      <Typography id={TITLE_ID} variant="h6" component="h2" sx={{ mb: 2 }}>
        {t(`games.expansions.${mode === "view" ? "details" : mode}`)}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {mode === "view" && current !== null ? (
        <Stack spacing={2}>
          <Field label={t("games.fields.title")}>{current.title}</Field>
          <Field label={t("games.fields.ownership")}>{t(`games.ownership.${current.ownership}`)}</Field>
          <Field label={t("games.fields.progress")}>{t(`games.progress.${current.progress}`)}</Field>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <GameTitleField
            value={draft.title}
            onChange={(title) => setDraft({ ...draft, title })}
            disabled={busy}
            autoFocus
          />
          <OwnershipField
            value={draft.ownership}
            onChange={(ownership) => setDraft({ ...draft, ownership })}
            disabled={busy}
          />
          <ProgressField
            value={draft.progress}
            onChange={(progress) => setDraft({ ...draft, progress })}
            disabled={busy}
          />
        </Stack>
      )}
      <ConfirmDialog
        open={confirmOpen}
        question={t("games.expansions.deleteQuestion")}
        destructive
        onDecision={(confirmed) => {
          setConfirmOpen(false);
          if (confirmed) void remove();
        }}
      />
    </BaseDialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Typography variant="overline" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography component="div">{children}</Typography>
    </div>
  );
}
