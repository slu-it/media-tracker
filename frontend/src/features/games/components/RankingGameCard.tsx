import { Box, Rating } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../../types/api";
import { GameCardShell } from "./GameCardShell";

// The standard visually-hidden pattern (offscreen but still in the accessibility tree): `aria-describedby`'s
// computed description only ever uses "name from content" (visible text), never a descendant's own `aria-label`
// (that is spec'd for accessible *name* computation, not description; see `GameCardShell`). The `Rating` widget
// below has no visible text of its own (just SVG stars), so a plain-text stand-in is added alongside it.
const VISUALLY_HIDDEN_SX = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

/**
 * Cover, title and a read-only star rating; no platform chips or status icons - the yearly ranking's own point
 * is the rating, and unrated games never reach this card (the backend's `rated` filter excludes them). The
 * rating's `role="group"` label matches `GameDetails`, so the same assistive-tech announcement applies wherever
 * a rating is shown. Passed as `description` (not `children`) so the card's explicit `aria-label` does not hide
 * it from screen readers: announced via `aria-describedby` alongside the title.
 */
export function RankingGameCard({ game, onOpen }: { game: GameResponse; onOpen: (game: GameResponse) => void }) {
  const { t } = useTranslation();
  const ratingText =
    game.rating === null ? t("games.notRated") : t("games.ranking.ratingValue", { rating: game.rating });
  return (
    <GameCardShell
      title={game.title}
      coverImageUrl={game.coverImageUrl}
      onClick={() => onOpen(game)}
      description={
        <>
          <Box role="group" aria-label={t("games.fields.rating")}>
            <Rating readOnly precision={0.25} size="small" value={game.rating} />
          </Box>
          <Box component="span" sx={VISUALLY_HIDDEN_SX}>
            {ratingText}
          </Box>
        </>
      }
    />
  );
}
