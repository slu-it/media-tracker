import { MEDIA_SUB_PAGES, type GameSubPage } from "../components/layout/mediaKinds";
import { useStoredChoice } from "./useStoredChoice";

export const GAMES_SUB_PAGE_STORAGE_KEY = "mt.gamesPage";
const DEFAULT_GAMES_SUB_PAGE: GameSubPage = "overview";

/** The selected games sub-page (overview, watchlist, ranking), restored from the last visit. */
export function useGamesSubPage(): [GameSubPage, (page: GameSubPage) => void] {
  return useStoredChoice<GameSubPage>(GAMES_SUB_PAGE_STORAGE_KEY, MEDIA_SUB_PAGES.games, DEFAULT_GAMES_SUB_PAGE);
}
