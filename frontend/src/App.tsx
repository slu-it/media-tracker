import { Box, Container } from "@mui/material";
import GridViewOutlined from "@mui/icons-material/GridViewOutlined";
import LeaderboardOutlined from "@mui/icons-material/LeaderboardOutlined";
import LibraryAddOutlined from "@mui/icons-material/LibraryAddOutlined";
import { useEffect, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { AppHeader } from "./components/layout/AppHeader";
import { MediaTabs } from "./components/layout/MediaTabs";
import { SubPageTabs } from "./components/layout/SubPageTabs";
import { MEDIA_SUB_PAGES, type GameSubPage, type MediaKind } from "./components/layout/mediaKinds";
import { useActiveRoute } from "./hooks/useActiveRoute";
import { BooksView } from "./features/books/BooksView";
import { GamesView } from "./features/games/GamesView";
import { GamesRankingView } from "./features/games/GamesRankingView";
import { GamesWatchlistView } from "./features/games/GamesWatchlistView";
import { MoviesView } from "./features/movies/MoviesView";
import { SeriesView } from "./features/series/SeriesView";
import {
  ROOT_PATH,
  allRoutes,
  pathFor,
  rememberRoute,
  storedPathFor,
  storedStartPath,
  type ActiveRoute,
} from "./routes";

const GAME_SUB_PAGE_ICONS: Record<GameSubPage, ReactElement> = {
  overview: <GridViewOutlined fontSize="small" />,
  watchlist: <LibraryAddOutlined fontSize="small" />,
  ranking: <LeaderboardOutlined fontSize="small" />,
};

const GAME_SUB_VIEWS: Record<GameSubPage, ReactElement> = {
  overview: <GamesView />,
  watchlist: <GamesWatchlistView />,
  ranking: <GamesRankingView />,
};

function viewFor({ kind, subPage }: ActiveRoute): ReactElement {
  switch (kind) {
    case "books":
      return <BooksView />;
    case "games":
      return GAME_SUB_VIEWS[subPage as GameSubPage];
    case "movies":
      return <MoviesView />;
    case "series":
      return <SeriesView />;
  }
}

/** Kinds that have sub-pages, whose bare `/{kind}` path redirects to the last-used sub-page. */
const KINDS_WITH_SUB_PAGES = Object.keys(MEDIA_SUB_PAGES) as MediaKind[];

/** Application shell: header, media-kind tabs, the active kind's sub-page tabs (if any), and the routed view. */
export function App() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const route = useActiveRoute();
  const kind = route?.kind;
  const subPage = route?.subPage;

  useEffect(() => {
    if (kind !== undefined) rememberRoute({ kind, subPage });
  }, [kind, subPage]);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />
      <MediaTabs />
      {kind === "games" && (
        <SubPageTabs
          value={subPage as GameSubPage}
          options={MEDIA_SUB_PAGES.games}
          onChange={(next) => void navigate(pathFor("games", next))}
          getLabel={(page) => t(`subPages.games.${page}`)}
          getIcon={(page) => GAME_SUB_PAGE_ICONS[page]}
        />
      )}
      <Container component="main" maxWidth="xl" sx={{ flex: 1, display: "flex", flexDirection: "column", py: 2 }}>
        <Routes>
          <Route path={ROOT_PATH} element={<Navigate to={storedStartPath()} replace />} />
          {KINDS_WITH_SUB_PAGES.map((k) => (
            <Route caseSensitive key={k} path={pathFor(k)} element={<Navigate to={storedPathFor(k)} replace />} />
          ))}
          {allRoutes().map((r) => (
            <Route
              caseSensitive
              key={pathFor(r.kind, r.subPage)}
              path={pathFor(r.kind, r.subPage)}
              element={viewFor(r)}
            />
          ))}
          <Route path="*" element={<Navigate to={ROOT_PATH} replace />} />
        </Routes>
      </Container>
    </Box>
  );
}
