import { useLoadOnce } from "../../../hooks/useLoadOnce";
import type { GamePlatformResponse } from "../../../types/api";
import { listGamePlatforms } from "../api/gamesApi";

export interface GamePlatformsState {
  platforms: GamePlatformResponse[] | null;
  error: string | null;
  reload: () => void;
}

/** Loads the selectable platforms once on mount; `reload()` retries after a failure. */
export function useGamePlatforms(loadErrorText: string): GamePlatformsState {
  const { data, error, reload } = useLoadOnce(listGamePlatforms, loadErrorText);
  return { platforms: data, error, reload };
}
