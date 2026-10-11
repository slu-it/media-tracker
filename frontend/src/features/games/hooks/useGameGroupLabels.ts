import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { GroupLabels } from "../../../domain/media/groups";

/** The i18n namespace holding the texts of a game grouping. */
export type GameGroupLabelPrefix = "games.developersView" | "games.seriesView";

/** The translated `GroupLabels` of a game grouping (`searchLabel`, `gameCount`, `deleteLabel`, ...). */
export function useGameGroupLabels(prefix: GameGroupLabelPrefix): GroupLabels {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      searchLabel: t(`${prefix}.searchLabel`),
      searchPlaceholder: t(`${prefix}.searchPlaceholder`),
      count: (count) => t(`${prefix}.count`, { count }),
      itemCount: (count) => t(`${prefix}.gameCount`, { count }),
      empty: t(`${prefix}.empty`),
      noSearchResults: (term) => t(`${prefix}.noSearchResults`, { term }),
      noItems: t(`${prefix}.noGames`),
      editLabel: (name) => t(`${prefix}.editLabel`, { name }),
      deleteLabel: (name) => t(`${prefix}.deleteLabel`, { name }),
      deleteQuestion: (name) => t(`${prefix}.deleteQuestion`, { name }),
      renameTitle: t(`${prefix}.renameTitle`),
      nameLabel: t(`${prefix}.nameLabel`),
      nameTaken: (existing, name) => t(`${prefix}.nameTaken`, { existing, name }),
      sortByVolume: t(`${prefix}.sortByVolume`),
      merge: t(`${prefix}.merge`),
      chooseOtherName: t(`${prefix}.chooseOtherName`),
    }),
    [t, prefix],
  );
}
