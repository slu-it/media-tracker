import { useState } from "react";
import { Alert } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../../../api/client";
import { BaseDialog } from "../../../components/dialog/BaseDialog";
import { DialogActionButton } from "../../../components/dialog/DialogActionButton";
import { MEDIA_DIALOG_HEIGHT } from "../../../components/media/dialogLayout";
import type { BookResponse, BookTypeResponse } from "../../../types/api";
import { createBook, resolveAuthorIds } from "../api/booksApi";
import { emptyBookDraft, isDraftValid, toCreateRequest } from "../domain/bookDraft";
import { BookForm } from "./BookForm";

interface AddBookDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (book: BookResponse) => void;
  /** `null` while the book types are still loading. */
  types: BookTypeResponse[] | null;
}

/** Same form as the edit mode, empty, with a save action only. Form state resets every time it opens. */
export function AddBookDialog({ open, onClose, onCreated, types }: AddBookDialogProps) {
  if (!open) return null;
  return <AddBookDialogContent onClose={onClose} onCreated={onCreated} types={types} />;
}

function AddBookDialogContent({ onClose, onCreated, types }: Omit<AddBookDialogProps, "open">) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(emptyBookDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Not part of `draft`: a rejected mid-edit in the release date picker never reaches `onChange`, so it cannot be
  // represented there; see `BookForm`'s `onValidityChange`.
  const [formValid, setFormValid] = useState(true);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const authorIds = await resolveAuthorIds(draft.authors);
      onCreated(await createBook(toCreateRequest(draft, authorIds)));
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
      disabled={busy || !isDraftValid(draft) || !formValid}
    />
  );

  return (
    <BaseDialog
      open
      onClose={onClose}
      actions={actions}
      ariaLabel={t("books.addBook")}
      height={MEDIA_DIALOG_HEIGHT}
      contentScroll="children"
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <BookForm value={draft} onChange={setDraft} types={types} disabled={busy} onValidityChange={setFormValid} />
    </BaseDialog>
  );
}
