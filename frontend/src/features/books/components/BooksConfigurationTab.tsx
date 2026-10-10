import { useMemo } from "react";
import { Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ColoredVocabularyEditor } from "../../../components/media/coloredVocabulary/ColoredVocabularyEditor";
import type { ColoredVocabularyLabels } from "../../../components/media/coloredVocabulary/coloredVocabulary";
import { createBookType, deleteBookType, listBookTypeSummaries, updateBookType } from "../api/booksApi";

/** Settings tab to manage the book types: color, name, add and delete (only while no book uses the type). */
export function BooksConfigurationTab({ onChanged }: { onChanged?: () => void }) {
  const { t } = useTranslation();
  const labels = useMemo<ColoredVocabularyLabels>(
    () => ({
      empty: t("books.configuration.empty"),
      count: (count) => t("books.configuration.count", { count }),
      addLabel: t("books.configuration.addLabel"),
      changeColor: (name) => t("books.configuration.changeColor", { name }),
      newColor: t("books.configuration.newColor"),
      editName: (name) => t("books.configuration.editName", { name }),
      deleteLabel: (name) => t("books.configuration.deleteLabel", { name }),
      deleteQuestion: (name) => t("books.configuration.deleteQuestion", { name }),
      deleteInUse: t("books.configuration.deleteInUse"),
      loadFailed: t("books.configuration.loadFailed"),
    }),
    [t],
  );

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1" component="h3">
        {t("books.configuration.title")}
      </Typography>
      <ColoredVocabularyEditor
        load={listBookTypeSummaries}
        create={createBookType}
        update={updateBookType}
        remove={deleteBookType}
        labels={labels}
        onChanged={() => onChanged?.()}
      />
    </Stack>
  );
}
