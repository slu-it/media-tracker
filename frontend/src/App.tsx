import { Box, Container } from "@mui/material";
import { useTranslation } from "react-i18next";
import { AppHeader } from "./components/layout/AppHeader";
import { MediaTabs } from "./components/layout/MediaTabs";
import { SubPageTabs } from "./components/layout/SubPageTabs";
import { MEDIA_SUB_PAGES, type GameSubPage, type MediaKind } from "./components/layout/mediaKinds";
import { useGamesSubPage } from "./hooks/useGamesSubPage";
import { useStoredTab } from "./hooks/useStoredTab";
import { BooksView } from "./features/books/BooksView";
import { GamesView } from "./features/games/GamesView";
import { GamesRankingView } from "./features/games/GamesRankingView";
import { GamesWatchlistView } from "./features/games/GamesWatchlistView";
import { MoviesView } from "./features/movies/MoviesView";
import { SeriesView } from "./features/series/SeriesView";

function GamesSubView({ page }: { page: GameSubPage }) {
  switch (page) {
    case "overview":
      return <GamesView />;
    case "watchlist":
      return <GamesWatchlistView />;
    case "ranking":
      return <GamesRankingView />;
  }
}

function MediaView({ kind, gamesSubPage }: { kind: MediaKind; gamesSubPage: GameSubPage }) {
  switch (kind) {
    case "books":
      return <BooksView />;
    case "games":
      return <GamesSubView page={gamesSubPage} />;
    case "movies":
      return <MoviesView />;
    case "series":
      return <SeriesView />;
  }
}

/** Application shell: header, media-kind tabs, the active kind's sub-page tabs (if any), and its view. */
export function App() {
  const { t } = useTranslation();
  const [tab, setTab] = useStoredTab();
  const [gamesSubPage, setGamesSubPage] = useGamesSubPage();
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />
      <MediaTabs value={tab} onChange={setTab} />
      {tab === "games" && (
        <SubPageTabs
          value={gamesSubPage}
          options={MEDIA_SUB_PAGES.games}
          onChange={setGamesSubPage}
          getLabel={(page) => t(`subPages.games.${page}`)}
        />
      )}
      <Container component="main" maxWidth="xl" sx={{ flex: 1, display: "flex", flexDirection: "column", py: 2 }}>
        <MediaView kind={tab} gamesSubPage={gamesSubPage} />
      </Container>
    </Box>
  );
}
