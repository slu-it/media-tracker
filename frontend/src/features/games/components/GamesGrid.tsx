import { Fragment, type ReactNode } from "react";
import { Box, Card, CardContent, Skeleton, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { coverHeight } from "../../../components/coverFrame";
import type { GameResponse } from "../../../types/api";
import { GameCard } from "./GameCard";
import { CARD_COVER_WIDTH } from "./GameCardShell";
import { SECTION_GAP } from "./gamesLayout";

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

const GRID_SX = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 2,
  py: SECTION_GAP,
};

function defaultRenderCard(game: GameResponse, onClick: () => void) {
  return <GameCard game={game} onOpen={onClick} />;
}

/** Responsive grid: as many columns as fit 200px cards. */
export function GamesGrid({ games, skeletons = 8, onOpen, searchTerm, filtered, renderCard }: GamesGridProps) {
  const { t } = useTranslation();
  if (games === null) {
    return (
      <Box sx={GRID_SX} aria-busy="true">
        {Array.from({ length: skeletons }, (_, i) => (
          <Card key={i} variant="outlined">
            <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
              <Skeleton variant="rounded" width={CARD_COVER_WIDTH} height={coverHeight(CARD_COVER_WIDTH)} />
              <Skeleton width="70%" height="2.6em" />
              <Skeleton variant="rounded" width="50%" height={24} />
              {/* The icon row is conditional on the real card (a default-status game shows none), so its
                  height is not reserved here either; reserving it would make every skeleton taller than
                  most real cards instead of matching them. */}
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }
  if (games.length === 0) {
    // A search term wins over an active filter: it names the exact text the user typed, while the filter
    // message only says "the selected filters" without listing them, so it is the less specific of the two.
    const message = searchTerm
      ? t("games.search.noResults", { term: searchTerm })
      : filtered
        ? t("games.filters.noResults")
        : t("games.empty");
    return (
      <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
        {message}
      </Typography>
    );
  }
  const render = renderCard ?? defaultRenderCard;
  return (
    <Box sx={GRID_SX}>
      {games.map((game) => (
        <Fragment key={game.id}>{render(game, () => onOpen(game))}</Fragment>
      ))}
    </Box>
  );
}
