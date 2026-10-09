import { Box, Chip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { formatSeriesEntry, formatSeriesPosition } from "../domain/seriesLabel";
import type { BookResponse } from "../../../types/api";
import { MediaCardShell } from "../../../components/media/MediaCardShell";
import { ColorChips } from "../../../components/media/ColorChips";
import { NameChips } from "../../../components/media/NameChips";
import { BOOK_COVER_ASPECT_RATIO } from "../domain/bookValues";
import { BookStatusIcons } from "./BookStatusIcons";

/** Height of a small MUI Chip. */
const SMALL_CHIP_HEIGHT = 24;

/**
 * Cover with the title centered underneath; the whole card opens the detail dialog. In the series view the position
 * badge is passed as `description`, placed centered above the cover, so the card's `aria-label` does not hide it
 * (announced via `aria-describedby`). An unnumbered book gets an invisible placeholder of the badge's height so
 * covers stay aligned within a grid row. Elsewhere (overview, authors view) the book's series are stacked chips
 * ("Mistborn #1") between cover and title, again as `description`; a book without series gets the same placeholder.
 */
export function BookCard({
  book,
  onOpen,
  seriesPosition,
}: {
  book: BookResponse;
  onOpen: (book: BookResponse) => void;
  /** Set by the series view: the book's number in the listed series, shown as a "#n" badge. */
  seriesPosition?: number | null;
}) {
  const { t, i18n } = useTranslation();
  const placeholder = <Box aria-hidden sx={{ height: SMALL_CHIP_HEIGHT, visibility: "hidden" }} />;
  const inSeriesView = seriesPosition !== undefined;
  return (
    <MediaCardShell
      title={book.title}
      coverImageUrl={book.coverImageUrl}
      coverAspectRatio={BOOK_COVER_ASPECT_RATIO}
      onClick={() => onOpen(book)}
      descriptionPlacement={inSeriesView ? "top" : "afterCover"}
      description={
        !inSeriesView ? (
          book.series.length > 0 ? (
            <NameChips
              direction="column"
              items={book.series.map((entry) => ({
                id: entry.id,
                name: formatSeriesEntry(entry, t, i18n.language),
              }))}
            />
          ) : (
            placeholder
          )
        ) : typeof seriesPosition === "number" ? (
          <Chip
            size="small"
            variant="outlined"
            label={t("books.seriesView.positionBadge", {
              position: formatSeriesPosition(seriesPosition, i18n.language),
            })}
          />
        ) : (
          placeholder
        )
      }
    >
      {book.types.length > 0 && <ColorChips items={book.types} />}
      <BookStatusIcons ownership={book.ownership} progress={book.progress} variant="card" />
    </MediaCardShell>
  );
}
