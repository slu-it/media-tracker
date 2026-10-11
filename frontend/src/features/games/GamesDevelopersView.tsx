import { useTranslation } from "react-i18next";
import { COVER_ASPECT_RATIO } from "../../components/coverFrame";
import type { MediaGroup, RenderGroupCard } from "../../domain/media/groups";
import { MediaGroupsView } from "../../components/media/groups/MediaGroupsView";
import type { GameResponse } from "../../types/api";
import {
  deleteGameDeveloper,
  listDeveloperGames,
  listGameDeveloperSummaries,
  mergeGameDeveloper,
  renameGameDeveloper,
} from "./api/gamesApi";
import { GameCard } from "./components/GameCard";
import { GameDialogsHost } from "./components/GameDialogsHost";
import { useGameGroupLabels } from "./hooks/useGameGroupLabels";
import { useGamesMeta } from "./hooks/useGamesMeta";

const renderCard: RenderGroupCard<GameResponse> = (game, onClick) => <GameCard game={game} onOpen={onClick} />;
const loadSummaries = (): Promise<MediaGroup[]> =>
  listGameDeveloperSummaries().then((summaries) =>
    summaries.map(({ id, name, gameCount }) => ({ id, name, itemCount: gameCount })),
  );

/** Every developer as an accordion; a section loads the developer's games when expanded. */
export function GamesDevelopersView() {
  const { t } = useTranslation();
  const labels = useGameGroupLabels("games.developersView");
  const { meta, reload: reloadMeta } = useGamesMeta(t("errors.loadFailed"));
  return (
    <MediaGroupsView
      loadSummaries={loadSummaries}
      loadItems={listDeveloperGames}
      renderCard={renderCard}
      coverAspectRatio={COVER_ASPECT_RATIO}
      deleteGroup={deleteGameDeveloper}
      renameGroup={renameGameDeveloper}
      mergeGroup={mergeGameDeveloper}
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
