import type { GameResponse } from "../../../types/api";
import { MediaCardShell } from "../../../components/media/MediaCardShell";
import { GameStatusIcons } from "./GameStatusIcons";
import { ColorChips } from "../../../components/media/ColorChips";

/** Cover with the title centered underneath; the whole card opens the detail dialog. */
export function GameCard({ game, onOpen }: { game: GameResponse; onOpen: (game: GameResponse) => void }) {
  return (
    <MediaCardShell
      title={game.title}
      coverImageUrl={game.coverImageUrl}
      onClick={() => onOpen(game)}
      desaturateCover={game.ownership === "watchlist"}
    >
      <ColorChips items={game.platforms} />
      <GameStatusIcons ownership={game.ownership} progress={game.progress} hidden={game.hidden} variant="card" />
    </MediaCardShell>
  );
}
