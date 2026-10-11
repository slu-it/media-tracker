import { useTranslation } from "react-i18next";
import { COVER_ASPECT_RATIO } from "../../components/coverFrame";
import type { MediaGroup, RenderGroupCard } from "../../domain/media/groups";
import { MediaGroupsView } from "../../components/media/groups/MediaGroupsView";
import type { GameResponse } from "../../types/api";
import {
  deleteGameSeries,
  listGameSeriesSummaries,
  listSeriesGames,
  mergeGameSeries,
  renameGameSeries,
} from "./api/gamesApi";
import { GameCard } from "./components/GameCard";
import { GameDialogsHost } from "./components/GameDialogsHost";
import { useGameGroupLabels } from "./hooks/useGameGroupLabels";
import { useGamesMeta } from "./hooks/useGamesMeta";

const renderCard: RenderGroupCard<GameResponse> = (game, onClick, series) => (
  <GameCard
    game={game}
    onOpen={onClick}
    seriesPosition={game.series.find((entry) => entry.id === series.id)?.position ?? null}
  />
);
const loadSummaries = (): Promise<MediaGroup[]> =>
  listGameSeriesSummaries().then((summaries) =>
    summaries.map(({ id, name, gameCount }) => ({ id, name, itemCount: gameCount })),
  );

/** Every series as an accordion; a card carries its "#n" position within the series. */
export function GamesSeriesView() {
  const { t } = useTranslation();
  const labels = useGameGroupLabels("games.seriesView");
  const { meta, reload: reloadMeta } = useGamesMeta(t("errors.loadFailed"));
  return (
    <MediaGroupsView
      loadSummaries={loadSummaries}
      loadItems={listSeriesGames}
      renderCard={renderCard}
      coverAspectRatio={COVER_ASPECT_RATIO}
      deleteGroup={deleteGameSeries}
      renameGroup={renameGameSeries}
      mergeGroup={mergeGameSeries}
      labels={labels}
      onRefresh={reloadMeta}
      renderDialogs={({ selected, onSelect, refresh, onDeleted }) => (
        <GameDialogsHost
          selected={selected}
          onSelect={onSelect}
          onCreated={refresh}
          onUpdated={refresh}
          onDeleted={onDeleted}
          platformCounts={meta?.platformCounts}
        />
      )}
    />
  );
}
