import { useState } from "react";
import { Alert } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import UndoIcon from "@mui/icons-material/Undo";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../../../api/client";
import { BaseDialog } from "../../../components/dialog/BaseDialog";
import { ConfirmDialog } from "../../../components/dialog/ConfirmDialog";
import { DialogActionButton } from "../../../components/dialog/DialogActionButton";
import { MEDIA_DIALOG_HEIGHT } from "../../../components/media/dialogLayout";
import type { BookResponse, BookTypeResponse, UpdateBookRequest } from "../../../types/api";
import { deleteBook, resolveAuthorIds, resolveNarratorIds, resolveSeries, updateBook } from "../api/booksApi";
import { draftFromBook, isDraftDirty, isDraftValid, toUpdateRequest } from "../domain/bookDraft";
import type { BookOwnership, BookProgress } from "../domain/bookStatus";
import { BookDetails } from "./BookDetails";
import { BookForm } from "./BookForm";

interface BookDetailDialogProps {
  /** The book to show; `null` closes the dialog. */
  book: BookResponse | null;
  onClose: () => void;
  onSaved: (updated: BookResponse) => void;
  onDeleted: (id: string) => void;
  /** `null` while the book types are still loading. */
  types: BookTypeResponse[] | null;
}

/** View/edit/delete one book. State lives in the inner component, keyed by book id, so it resets per book. */
export function BookDetailDialog({ book, onClose, onSaved, onDeleted, types }: BookDetailDialogProps) {
  if (book === null) return null;
  return (
    <BookDetailDialogContent
      key={book.id}
      book={book}
      onClose={onClose}
      onSaved={onSaved}
      onDeleted={onDeleted}
      types={types}
    />
  );
}

const TITLE_ID = "book-detail-title";

type QuickPatch = Pick<UpdateBookRequest, "progress" | "ownership">;

function BookDetailDialogContent({
  book,
  onClose,
  onSaved,
  onDeleted,
  types,
}: Omit<BookDetailDialogProps, "book"> & { book: BookResponse }) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState(() => draftFromBook(book, i18n.language));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Overlay on the displayed book while a quick progress/ownership PATCH is in flight.
  const [pending, setPending] = useState<QuickPatch | null>(null);
  // Not part of `draft`: a rejected mid-edit in the release date picker never reaches `onChange`, so it cannot be
  // represented there; see `BookForm`'s `onValidityChange`.
  const [formValid, setFormValid] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const startEditing = () => {
    setDraft(draftFromBook(book, i18n.language));
    setError(null);
    setFormValid(true);
    setMode("edit");
  };

  const cancelEditing = () => {
    setDraft(draftFromBook(book, i18n.language));
    setError(null);
    setFormValid(true);
    setMode("view");
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const authorIds = await resolveAuthorIds(draft.authors);
      const narratorIds = await resolveNarratorIds(draft.narrators);
      const series = await resolveSeries(draft.series);
      const updated = await updateBook(book.id, toUpdateRequest(book, draft, { authorIds, narratorIds, series }));
      setDraft(draftFromBook(updated, i18n.language));
      setMode("view");
      onSaved(updated);
    } catch (cause: unknown) {
      setError(errorMessage(cause, t("errors.saveFailed")));
    } finally {
      setBusy(false);
    }
  };

  const quickPatch = async (patch: QuickPatch) => {
    // The controls stay enabled (focus), so a second change can arrive while one is in flight.
    if (busy) return;
    setBusy(true);
    setError(null);
    setPending(patch);
    try {
      const updated = await updateBook(book.id, patch);
      setDraft(draftFromBook(updated, i18n.language));
      onSaved(updated);
    } catch (cause: unknown) {
      setError(errorMessage(cause, t("errors.saveFailed")));
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const changeOwnership = (next: BookOwnership) => quickPatch({ ownership: next });

  const changeProgress = (next: BookProgress) => quickPatch({ progress: next });

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteBook(book.id);
      onDeleted(book.id);
    } catch (cause: unknown) {
      setError(errorMessage(cause, t("errors.deleteFailed")));
      setBusy(false);
    }
  };

  const canSave = !busy && isDraftValid(draft) && isDraftDirty(book, draft) && formValid;

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
        <DialogActionButton icon={<UndoIcon />} label={t("common.cancel")} onClick={cancelEditing} disabled={busy} />
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
      titleId={mode === "view" ? TITLE_ID : undefined}
      ariaLabel={mode === "edit" ? t("books.editBook") : undefined}
      height={MEDIA_DIALOG_HEIGHT}
      contentScroll="children"
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {mode === "view" ? (
        <BookDetails
          book={pending === null ? book : { ...book, ...pending }}
          titleId={TITLE_ID}
          onOwnershipChange={(next) => void changeOwnership(next)}
          onProgressChange={(next) => void changeProgress(next)}
          quickSaveBusy={busy}
        />
      ) : (
        <BookForm value={draft} onChange={setDraft} types={types} disabled={busy} onValidityChange={setFormValid} />
      )}
      <ConfirmDialog
        open={confirmOpen}
        question={t("books.deleteQuestion", { title: book.title })}
        destructive
        onDecision={(confirmed) => {
          setConfirmOpen(false);
          if (confirmed) void remove();
        }}
      />
    </BaseDialog>
  );
}
