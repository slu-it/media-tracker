import { Box, Card, CardContent, Skeleton, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../../types/api";
import { CARD_COVER_HEIGHT, CARD_COVER_WIDTH, GameCard } from "./GameCard";

interface GamesGridProps {
  games: GameResponse[] | null;
  /** Number of skeleton cards to show while `games` is still null. */
  skeletons?: number;
  onOpen: (game: GameResponse) => void;
}

const GRID_SX = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 2, py: 2 };

/** Responsive grid: as many columns as fit 200px cards. */
export function GamesGrid({ games, skeletons = 8, onOpen }: GamesGridProps) {
  const { t } = useTranslation();
  if (games === null) {
    return (
      <Box sx={GRID_SX} aria-busy="true">
        {Array.from({ length: skeletons }, (_, i) => (
          <Card key={i} variant="outlined">
            <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
              <Skeleton variant="rounded" width={CARD_COVER_WIDTH} height={CARD_COVER_HEIGHT} />
              <Skeleton width="70%" />
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }
  if (games.length === 0) {
    return (
      <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
        {t("games.empty")}
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
