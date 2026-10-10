import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { GroupLabels } from "../../../domain/media/groups";

/** The translated `GroupLabels` of the developers view (`games.developersView.*`). */
export function useDeveloperGroupLabels(): GroupLabels {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      searchLabel: t("games.developersView.searchLabel"),
      searchPlaceholder: t("games.developersView.searchPlaceholder"),
      count: (count) => t("games.developersView.count", { count }),
      itemCount: (count) => t("games.developersView.gameCount", { count }),
      empty: t("games.developersView.empty"),
      noSearchResults: (term) => t("games.developersView.noSearchResults", { term }),
      noItems: t("games.developersView.noGames"),
      editLabel: (name) => t("games.developersView.editLabel", { name }),
      deleteLabel: (name) => t("games.developersView.deleteLabel", { name }),
      deleteQuestion: (name) => t("games.developersView.deleteQuestion", { name }),
      renameTitle: t("games.developersView.renameTitle"),
      nameLabel: t("games.developersView.nameLabel"),
      nameTaken: (existing, name) => t("games.developersView.nameTaken", { existing, name }),
      sortByVolume: t("games.developersView.sortByVolume"),
      merge: t("games.developersView.merge"),
      chooseOtherName: t("games.developersView.chooseOtherName"),
    }),
    [t],
  );
}
