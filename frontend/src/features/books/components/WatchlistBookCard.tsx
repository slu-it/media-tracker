import { Typography } from "@mui/material";
import type { BookResponse } from "../../../types/api";
import { formatReleaseDate } from "../../../domain/media/releaseDate";
import { MediaCardShell } from "../../../components/media/MediaCardShell";
import { BOOK_COVER_ASPECT_RATIO } from "../domain/bookValues";

/**
 * Cover with the title and one line of release info centered underneath: the exact date when known, otherwise
 * just the year. No series, type chips or status icons, unlike `BookCard` - every watchlist card already shares
 * the same ownership, and the type filter above the grid covers that dimension instead. Passed as `description`
 * (not `children`) so the card's explicit `aria-label` does not hide it from screen readers. Every card here is a
 * watchlist book, so the cover is always shown in grayscale at half opacity.
 */
export function WatchlistBookCard({ book, onOpen }: { book: BookResponse; onOpen: (book: BookResponse) => void }) {
  return (
    <MediaCardShell
      title={book.title}
      coverImageUrl={book.coverImageUrl}
      coverAspectRatio={BOOK_COVER_ASPECT_RATIO}
      onClick={() => onOpen(book)}
      desaturateCover={book.ownership === "watchlist"}
      description={
        <Typography variant="body2" color="text.secondary">
          {book.releaseDate ? formatReleaseDate(book.releaseDate) : book.releaseYear}
        </Typography>
      }
    />
  );
}
