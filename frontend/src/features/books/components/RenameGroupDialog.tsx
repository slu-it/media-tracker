import { useState, type FormEvent } from "react";
import { Alert, Typography } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import UndoIcon from "@mui/icons-material/Undo";
import { useTranslation } from "react-i18next";
import { ApiError, errorMessage } from "../../../api/client";
import { BaseDialog } from "../../../components/dialog/BaseDialog";
import { ConfirmDialog } from "../../../components/dialog/ConfirmDialog";
import { DialogActionButton } from "../../../components/dialog/DialogActionButton";
import { VocabularyNameField } from "../../../components/media/fields/VocabularyNameField";
import { validateVocabularyName } from "../../../domain/media/values";
import type { BookGroup, BookGroupLabelPrefix } from "./BookGroupAccordion";

const TITLE_ID = "rename-group-title";

interface RenameGroupDialogProps {
  group: BookGroup;
  labelPrefix: BookGroupLabelPrefix;
  /** Renames the group; rejects with an `ApiError` 409 `name_taken` when another entry has the name. */
  onRename: (name: string) => Promise<void>;
  /** Merges the group into the entry `targetId`. */
  onMerge: (targetId: string) => Promise<void>;
  onClose: () => void;
}

interface TakenBy {
  id: string;
  name: string;
}

/** Renames an author or series; a taken name offers to merge into the existing entry instead. Mount it only while open. */
export function RenameGroupDialog({ group, labelPrefix, onRename, onMerge, onClose }: RenameGroupDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<TakenBy | null>(null);

  const code = validateVocabularyName(name);
  const trimmed = name.trim();
  const canSave = !busy && code === null && trimmed !== group.name;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await onRename(trimmed);
      onClose();
    } catch (cause: unknown) {
      const body = cause instanceof ApiError && cause.status === 409 ? cause.body : undefined;
      if (body?.error === "name_taken" && body.existingId !== undefined) {
        setTaken({ id: body.existingId, name: body.existingName ?? trimmed });
      } else {
        setError(errorMessage(cause, t("errors.saveFailed")));
      }
      setBusy(false);
    }
  };

  const decide = async (merge: boolean) => {
    const target = taken;
    setTaken(null);
    if (!merge || target === null) return;
    setBusy(true);
    try {
      await onMerge(target.id);
      onClose();
    } catch (cause: unknown) {
      setError(errorMessage(cause, t("errors.saveFailed")));
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save();
  };

  return (
    <>
      <BaseDialog
        open
        onClose={onClose}
        titleId={TITLE_ID}
        maxWidth="xs"
        actions={
          <>
            <DialogActionButton
              icon={<SaveIcon />}
              label={t("common.save")}
              color="primary"
              onClick={() => void save()}
              disabled={!canSave}
            />
            <DialogActionButton icon={<UndoIcon />} label={t("common.cancel")} onClick={onClose} disabled={busy} />
          </>
        }
      >
        <Typography id={TITLE_ID} variant="h6" component="h2" sx={{ mb: 2 }}>
          {t(`${labelPrefix}.renameTitle`)}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <form onSubmit={submit} noValidate>
          <VocabularyNameField
            label={t(`${labelPrefix}.nameLabel`)}
            value={name}
            onChange={setName}
            disabled={busy}
            showErrors
            autoFocus
          />
        </form>
      </BaseDialog>
      <ConfirmDialog
        open={taken !== null}
        question={t(`${labelPrefix}.nameTaken`, { existing: taken?.name, name: group.name })}
        confirmLabel={t(`${labelPrefix}.merge`)}
        cancelLabel={t(`${labelPrefix}.chooseOtherName`)}
        focusCancel
        onDecision={(merge) => void decide(merge)}
      />
    </>
  );
}
