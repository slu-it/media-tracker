import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { AddSpeedDial } from "../../../components/media/AddSpeedDial";
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
  /** Usage count per book type id (meta), which decides the presets of the add button. */
  typeCounts?: Record<string, number>;
}

/**
 * Add speed dial + `AddBookDialog` + `BookDetailDialog`, wired to the shared create/edit/delete flow: open the detail dialog
 * on selection, create a book via the speed dial, reload the caller's list/meta afterwards. Owns the selectable book
 * types lookup the two dialogs need, so a page only has to control which book is selected.
 */
export function BookDialogsHost({
  selected,
  onSelect,
  onCreated,
  onUpdated,
  onDeleted,
  typeCounts,
}: BookDialogsHostProps) {
  const { t } = useTranslation();
  const { types, error: typesError, reload: reloadTypes } = useBookTypes(t("errors.loadFailed"));
  // `null` while the add dialog is closed; `id` is the preset chosen on the add button.
  const [addPreset, setAddPreset] = useState<{ id?: string } | null>(null);
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

      <AddSpeedDial
        label={t("books.addBook")}
        options={types}
        counts={typeCounts}
        onAdd={(id) => setAddPreset({ id })}
      />

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
        open={addPreset !== null}
        onClose={() => setAddPreset(null)}
        onCreated={(book) => {
          setAddPreset(null);
          onCreated(book);
        }}
        types={types}
        initialTypeIds={addPreset?.id ? [addPreset.id] : undefined}
      />
    </>
  );
}
