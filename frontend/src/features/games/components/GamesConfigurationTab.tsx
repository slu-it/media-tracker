import { useMemo } from "react";
import { Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ColoredVocabularyEditor } from "../../../components/media/coloredVocabulary/ColoredVocabularyEditor";
import type { ColoredVocabularyLabels } from "../../../components/media/coloredVocabulary/coloredVocabulary";
import { createGamePlatform, deleteGamePlatform, listGamePlatformSummaries, updateGamePlatform } from "../api/gamesApi";

/** Settings tab to manage the platforms: color, name, add and delete (only while no game uses the platform). */
export function GamesConfigurationTab({ onChanged }: { onChanged?: () => void }) {
  const { t } = useTranslation();
  const labels = useMemo<ColoredVocabularyLabels>(
    () => ({
      empty: t("games.configuration.empty"),
      count: (count) => t("games.configuration.count", { count }),
      addLabel: t("games.configuration.addLabel"),
      changeColor: (name) => t("games.configuration.changeColor", { name }),
      newColor: t("games.configuration.newColor"),
      editName: (name) => t("games.configuration.editName", { name }),
      deleteLabel: (name) => t("games.configuration.deleteLabel", { name }),
      deleteQuestion: (name) => t("games.configuration.deleteQuestion", { name }),
      deleteInUse: t("games.configuration.deleteInUse"),
      loadFailed: t("games.configuration.loadFailed"),
    }),
    [t],
  );

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1" component="h3">
        {t("games.configuration.title")}
      </Typography>
      <ColoredVocabularyEditor
        load={listGamePlatformSummaries}
        create={createGamePlatform}
        update={updateGamePlatform}
        remove={deleteGamePlatform}
        labels={labels}
        onChanged={() => onChanged?.()}
      />
    </Stack>
  );
}
