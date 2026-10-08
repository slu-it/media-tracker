import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MediaGrid } from "../../../components/media/MediaGrid";
import type { GameResponse } from "../../../types/api";
import { GameCard } from "./GameCard";

interface GamesGridProps {
  games: GameResponse[] | null;
  /** Number of skeleton cards to show while `games` is still null. */
  skeletons?: number;
  onOpen: (game: GameResponse) => void;
  /** Active search term, if any; switches the empty state to a search-specific message. */
  searchTerm?: string;
  /** Whether a platform/ownership/progress/release-year filter is narrowing the list; see [searchTerm]. */
  filtered?: boolean;
  /** Card renderer; defaults to `GameCard`. `onClick` already captures the game a click should open. */
  renderCard?: (game: GameResponse, onClick: () => void) => ReactNode;
}

function defaultRenderCard(game: GameResponse, onClick: () => void) {
  return <GameCard game={game} onOpen={onClick} />;
}

/** The games flavour of `MediaGrid`: `GameCard`s by default and the games' empty-state texts. */
export function GamesGrid({ games, skeletons, onOpen, searchTerm, filtered, renderCard }: GamesGridProps) {
  const { t } = useTranslation();
  return (
    <MediaGrid
      items={games}
      skeletons={skeletons}
      onOpen={onOpen}
      searchTerm={searchTerm}
      filtered={filtered}
      renderCard={renderCard ?? defaultRenderCard}
      messages={{
        empty: t("games.empty"),
        noSearchResults: (term) => t("games.search.noResults", { term }),
        noFilterResults: t("games.filters.noResults"),
      }}
    />
  );
}
