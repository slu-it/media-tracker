import { Box, Container } from "@mui/material";
import { AppHeader } from "./components/layout/AppHeader";
import { MediaTabs } from "./components/layout/MediaTabs";
import type { MediaKind } from "./components/layout/mediaKinds";
import { useStoredTab } from "./hooks/useStoredTab";
import { BooksView } from "./features/books/BooksView";
import { GamesView } from "./features/games/GamesView";
import { MoviesView } from "./features/movies/MoviesView";
import { SeriesView } from "./features/series/SeriesView";

function MediaView({ kind }: { kind: MediaKind }) {
  switch (kind) {
    case "books":
      return <BooksView />;
    case "games":
      return <GamesView />;
    case "movies":
      return <MoviesView />;
    case "series":
      return <SeriesView />;
  }
}

/** Application shell: header, media-kind tabs, and the view of the selected kind. */
export function App() {
  const [tab, setTab] = useStoredTab();
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />
      <MediaTabs value={tab} onChange={setTab} />
      <Container component="main" maxWidth="xl" sx={{ flex: 1, display: "flex", flexDirection: "column", py: 2 }}>
        <MediaView kind={tab} />
      </Container>
    </Box>
  );
}
