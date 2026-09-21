import { Box, Card, CardContent, Skeleton, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../../types/api";
import { CARD_COVER_HEIGHT, CARD_COVER_WIDTH, GameCard } from "./GameCard";

interface GamesGridProps {
  games: GameResponse[] | null;
  /** Number of skeleton cards to show while `games` is still null. */
  skeletons?: number;
  onOpen: (game: GameResponse) => void;
  /** Active search term, if any; switches the empty state to a search-specific message. */
  searchTerm?: string;
  /** Whether a platform/ownership/progress/release-year filter is narrowing the list; see [searchTerm]. */
  filtered?: boolean;
}

const GRID_SX = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 2, py: 2 };

/** Responsive grid: as many columns as fit 200px cards. */
export function GamesGrid({ games, skeletons = 8, onOpen, searchTerm, filtered }: GamesGridProps) {
  const { t } = useTranslation();
  if (games === null) {
    return (
      <Box sx={GRID_SX} aria-busy="true">
        {Array.from({ length: skeletons }, (_, i) => (
          <Card key={i} variant="outlined">
            <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
              <Skeleton variant="rounded" width={CARD_COVER_WIDTH} height={CARD_COVER_HEIGHT} />
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
  return (
    <Box sx={GRID_SX}>
      {games.map((game) => (
        <GameCard key={game.id} game={game} onOpen={onOpen} />
      ))}
    </Box>
  );
}
