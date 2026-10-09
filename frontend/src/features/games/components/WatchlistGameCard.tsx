import { Typography } from "@mui/material";
import type { GameResponse } from "../../../types/api";
import { formatReleaseDate } from "../../../domain/media/releaseDate";
import { MediaCardShell } from "../../../components/media/MediaCardShell";

/**
 * Cover with the title and one line of release info centered underneath: the exact date when known, otherwise
 * just the year. No platform chips or status icons, unlike `GameCard` - every watchlist card already shares the
 * same ownership, and the platform filter above the grid covers that dimension instead. Passed as `description`
 * (not `children`) so the card's explicit `aria-label` does not hide it from screen readers. Every card here is a
 * watchlist game, so the cover is always shown in grayscale at half opacity.
 */
export function WatchlistGameCard({ game, onOpen }: { game: GameResponse; onOpen: (game: GameResponse) => void }) {
  return (
    <MediaCardShell
      title={game.title}
      coverImageUrl={game.coverImageUrl}
      onClick={() => onOpen(game)}
      desaturateCover={game.ownership === "watchlist"}
      description={
        <Typography variant="body2" color="text.secondary">
          {game.releaseDate ? formatReleaseDate(game.releaseDate) : game.releaseYear}
        </Typography>
      }
    />
  );
}
