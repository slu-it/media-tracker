import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useTranslation } from "react-i18next";
import type { BookResponse, BookSeriesSummaryResponse } from "../../../types/api";
import { MediaGrid } from "../../../components/media/MediaGrid";
import { SECTION_GAP } from "../../../components/media/mediaLayout";
import { BOOK_COVER_ASPECT_RATIO } from "../domain/bookValues";
import { useSeriesBooks } from "../hooks/useSeriesBooks";
import { BookCard } from "./BookCard";

const MAX_SKELETONS = 8;

interface BookSeriesAccordionProps {
  series: BookSeriesSummaryResponse;
  expanded: boolean;
  onToggle: (seriesId: string, expanded: boolean) => void;
  /** Bumped after a save anywhere, so an open section refetches. */
  reloadToken: number;
  onOpen: (book: BookResponse) => void;
}

/** One series: name and book count in the summary; the books are loaded when the section is expanded. */
export function BookSeriesAccordion({ series, expanded, onToggle, reloadToken, onOpen }: BookSeriesAccordionProps) {
  const { t } = useTranslation();
  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => onToggle(series.id, isExpanded)}
      slotProps={{ transition: { unmountOnExit: true }, heading: { component: "h2" } }}
      disableGutters
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Typography component="span" variant="subtitle1">
            {series.name}
          </Typography>
          <Chip size="small" label={t("books.seriesView.bookCount", { count: series.bookCount })} />
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {series.bookCount === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
            {t("books.seriesView.noBooks")}
          </Typography>
        ) : (
          <SeriesBooks series={series} reloadToken={reloadToken} onOpen={onOpen} />
        )}
      </AccordionDetails>
    </Accordion>
  );
}

function SeriesBooks({
  series,
  reloadToken,
  onOpen,
}: {
  series: BookSeriesSummaryResponse;
  reloadToken: number;
  onOpen: (book: BookResponse) => void;
}) {
  const { t } = useTranslation();
  const { books, error, reload } = useSeriesBooks(series.id, reloadToken, t("errors.loadFailed"));
  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: SECTION_GAP }} action={<Button onClick={reload}>{t("common.retry")}</Button>}>
          {error}
        </Alert>
      )}
      <MediaGrid
        items={books}
        skeletons={Math.min(series.bookCount, MAX_SKELETONS)}
        onOpen={onOpen}
        renderCard={(book, onClick) => (
          <BookCard
            book={book}
            onOpen={onClick}
            seriesPosition={book.series.find((entry) => entry.id === series.id)?.position ?? null}
          />
        )}
        coverAspectRatio={BOOK_COVER_ASPECT_RATIO}
        messages={{
          empty: t("books.seriesView.noBooks"),
          noSearchResults: () => t("books.seriesView.noBooks"),
          noFilterResults: t("books.seriesView.noBooks"),
        }}
      />
    </>
  );
}
