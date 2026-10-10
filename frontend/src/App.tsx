import { Box, Container } from "@mui/material";
import CollectionsBookmarkOutlined from "@mui/icons-material/CollectionsBookmarkOutlined";
import GridViewOutlined from "@mui/icons-material/GridViewOutlined";
import EngineeringOutlined from "@mui/icons-material/EngineeringOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import LeaderboardOutlined from "@mui/icons-material/LeaderboardOutlined";
import LibraryAddOutlined from "@mui/icons-material/LibraryAddOutlined";
import RecordVoiceOverOutlined from "@mui/icons-material/RecordVoiceOverOutlined";
import { useEffect, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { AppHeader } from "./components/layout/AppHeader";
import { MediaTabs } from "./components/layout/MediaTabs";
import { SubPageTabs } from "./components/layout/SubPageTabs";
import {
  MEDIA_SUB_PAGES,
  type BookSubPage,
  type GameSubPage,
  type MediaKind,
  type SubPage,
} from "./components/layout/mediaKinds";
import { useDataRevision } from "./hooks/dataRevision";
import { useActiveRoute } from "./hooks/useActiveRoute";
import { BookAuthorsView } from "./features/books/BookAuthorsView";
import { BookNarratorsView } from "./features/books/BookNarratorsView";
import { BookSeriesView } from "./features/books/BookSeriesView";
import { BooksView } from "./features/books/BooksView";
import { BooksWatchlistView } from "./features/books/BooksWatchlistView";
import { GamesDevelopersView } from "./features/games/GamesDevelopersView";
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
  subPagesOf,
  storedPathFor,
  storedStartPath,
  type ActiveRoute,
} from "./routes";

/** Sub-page icons, shared by every kind (the overview icon is the same everywhere). */
const SUB_PAGE_ICONS: Record<SubPage, ReactElement> = {
  overview: <GridViewOutlined fontSize="small" />,
  watchlist: <LibraryAddOutlined fontSize="small" />,
  ranking: <LeaderboardOutlined fontSize="small" />,
  authors: <PersonOutlined fontSize="small" />,
  narrators: <RecordVoiceOverOutlined fontSize="small" />,
  developers: <EngineeringOutlined fontSize="small" />,
  series: <CollectionsBookmarkOutlined fontSize="small" />,
};

const BOOK_SUB_VIEWS: Record<BookSubPage, ReactElement> = {
  overview: <BooksView />,
  watchlist: <BooksWatchlistView />,
  authors: <BookAuthorsView />,
  narrators: <BookNarratorsView />,
  series: <BookSeriesView />,
};

const GAME_SUB_VIEWS: Record<GameSubPage, ReactElement> = {
  overview: <GamesView />,
  watchlist: <GamesWatchlistView />,
  ranking: <GamesRankingView />,
  developers: <GamesDevelopersView />,
};

function viewFor({ kind, subPage }: ActiveRoute): ReactElement {
  switch (kind) {
    case "books":
      return BOOK_SUB_VIEWS[subPage as BookSubPage];
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
  const { revision } = useDataRevision();
  const kind = route?.kind;
  const subPage = route?.subPage;
  const subPages = (kind === undefined ? [] : subPagesOf(kind)) as readonly SubPage[];

  useEffect(() => {
    if (kind !== undefined) rememberRoute({ kind, subPage });
  }, [kind, subPage]);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />
      <MediaTabs />
      {kind !== undefined && subPages.length > 0 && (
        <SubPageTabs
          value={subPage as SubPage}
          options={subPages}
          onChange={(next) => void navigate(pathFor(kind, next))}
          getLabel={(page) => t(`subPages.pages.${page}`)}
          ariaLabel={t(`subPages.label.${kind as keyof typeof MEDIA_SUB_PAGES}`)}
          getIcon={(page) => SUB_PAGE_ICONS[page]}
        />
      )}
      <Container
        key={revision}
        component="main"
        maxWidth="xl"
        sx={{ flex: 1, display: "flex", flexDirection: "column", py: 2 }}
      >
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
