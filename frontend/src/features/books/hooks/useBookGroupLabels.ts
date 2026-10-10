import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { GroupLabels } from "../../../domain/media/groups";

/** The i18n namespace holding the texts of a book grouping. */
export type BookGroupLabelPrefix = "books.seriesView" | "books.authorsView" | "books.narratorsView";

/** The translated `GroupLabels` of a book grouping (`searchLabel`, `bookCount`, `deleteLabel`, ...). */
export function useBookGroupLabels(prefix: BookGroupLabelPrefix): GroupLabels {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      searchLabel: t(`${prefix}.searchLabel`),
      searchPlaceholder: t(`${prefix}.searchPlaceholder`),
      count: (count) => t(`${prefix}.count`, { count }),
      itemCount: (count) => t(`${prefix}.bookCount`, { count }),
      empty: t(`${prefix}.empty`),
      noSearchResults: (term) => t(`${prefix}.noSearchResults`, { term }),
      noItems: t(`${prefix}.noBooks`),
      editLabel: (name) => t(`${prefix}.editLabel`, { name }),
      deleteLabel: (name) => t(`${prefix}.deleteLabel`, { name }),
      deleteQuestion: (name) => t(`${prefix}.deleteQuestion`, { name }),
      renameTitle: t(`${prefix}.renameTitle`),
      nameLabel: t(`${prefix}.nameLabel`),
      nameTaken: (existing, name) => t(`${prefix}.nameTaken`, { existing, name }),
      merge: t(`${prefix}.merge`),
      chooseOtherName: t(`${prefix}.chooseOtherName`),
    }),
    [t, prefix],
  );
}
