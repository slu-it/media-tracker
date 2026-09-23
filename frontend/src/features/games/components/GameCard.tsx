import { Card, CardActionArea, CardContent, Typography } from "@mui/material";
import { CoverImage } from "../../../components/CoverImage";
import type { GameResponse } from "../../../types/api";
import { GameStatusIcons } from "./GameStatusIcons";
import { PlatformChips } from "./PlatformChips";

export const CARD_COVER_WIDTH = 168;

/** Cover with the title centered underneath; the whole card opens the detail dialog. */
export function GameCard({ game, onOpen }: { game: GameResponse; onOpen: (game: GameResponse) => void }) {
  return (
    <Card variant="outlined">
      <CardActionArea onClick={() => onOpen(game)} aria-label={game.title} sx={{ height: "100%" }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
          <CoverImage src={game.coverImageUrl} alt="" width={CARD_COVER_WIDTH} />
          <Typography
            variant="subtitle1"
            component="h3"
            align="center"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.3,
              minHeight: "2.6em",
            }}
          >
            {game.title}
          </Typography>
          <PlatformChips platforms={game.platforms} />
          <GameStatusIcons ownership={game.ownership} progress={game.progress} hidden={game.hidden} />
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
