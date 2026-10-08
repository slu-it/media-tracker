import { useEffect, useRef, useState } from "react";
import { Alert, Button, Fab } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import type { BookResponse } from "../../../types/api";
import { useBookTypes } from "../hooks/useBookTypes";
import { AddBookDialog } from "./AddBookDialog";
import { BookDetailDialog } from "./BookDetailDialog";

interface BookDialogsHostProps {
  /** The book whose detail dialog is open; `null` closes it. */
  selected: BookResponse | null;
  onSelect: (book: BookResponse | null) => void;
  onCreated: (book: BookResponse) => void;
  onUpdated: (book: BookResponse) => void;
  onDeleted: (id: string) => void;
}

/**
 * FAB + `AddBookDialog` + `BookDetailDialog`, wired to the shared create/edit/delete flow: open the detail dialog
 * on selection, create a book via the FAB, reload the caller's list/meta afterwards. Owns the selectable book
 * types lookup the two dialogs need, so a page only has to control which book is selected.
 */
export function BookDialogsHost({ selected, onSelect, onCreated, onUpdated, onDeleted }: BookDialogsHostProps) {
  const { t } = useTranslation();
  const { types, error: typesError, reload: reloadTypes } = useBookTypes(t("errors.loadFailed"));
  const [addOpen, setAddOpen] = useState(false);
  // Read when a save resolves: the dialog may have been closed or switched to another book meanwhile.
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  return (
    <>
      {typesError && (
        <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={reloadTypes}>{t("common.retry")}</Button>}>
          {typesError}
        </Alert>
      )}

      <Fab
        color="primary"
        aria-label={t("books.addBook")}
        onClick={() => setAddOpen(true)}
        disabled={types === null}
        sx={{ position: "fixed", right: 24, bottom: 24 }}
      >
        <AddIcon />
      </Fab>

      <BookDetailDialog
        book={selected}
        onClose={() => onSelect(null)}
        onSaved={(updated) => {
          if (selectedRef.current?.id === updated.id) onSelect(updated);
          onUpdated(updated);
        }}
        onDeleted={onDeleted}
        types={types}
      />
      <AddBookDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(book) => {
          setAddOpen(false);
          onCreated(book);
        }}
        types={types}
      />
    </>
  );
}
