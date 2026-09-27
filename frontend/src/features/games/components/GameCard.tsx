import type { GameResponse } from "../../../types/api";
import { GameCardShell } from "./GameCardShell";
import { GameStatusIcons } from "./GameStatusIcons";
import { PlatformChips } from "./PlatformChips";

/** Cover with the title centered underneath; the whole card opens the detail dialog. */
export function GameCard({ game, onOpen }: { game: GameResponse; onOpen: (game: GameResponse) => void }) {
  return (
    <GameCardShell title={game.title} coverImageUrl={game.coverImageUrl} onClick={() => onOpen(game)}>
      <PlatformChips platforms={game.platforms} />
      <GameStatusIcons ownership={game.ownership} progress={game.progress} hidden={game.hidden} />
    </GameCardShell>
  );
}
