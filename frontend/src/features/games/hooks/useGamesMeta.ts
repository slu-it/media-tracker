import { useLoadOnce } from "../../../hooks/useLoadOnce";
import type { GameMetaResponse } from "../../../types/api";
import { getGamesMeta } from "../api/gamesApi";

export interface GamesMetaState {
  meta: GameMetaResponse | null;
  error: string | null;
  reload: () => void;
}

/** Loads the filterable values once on mount; `reload()` retries after a failure. */
export function useGamesMeta(loadErrorText: string): GamesMetaState {
  const { data, error, reload } = useLoadOnce(getGamesMeta, loadErrorText);
  return { meta: data, error, reload };
}
