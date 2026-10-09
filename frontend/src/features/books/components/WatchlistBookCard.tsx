import type { BookResponse } from "../../../types/api";
import { ReleaseInfo } from "../../../components/media/ReleaseInfo";
import { MediaCardShell } from "../../../components/media/MediaCardShell";
import { BOOK_COVER_ASPECT_RATIO } from "../domain/bookValues";

/**
 * Cover with the title and the release info (see `ReleaseInfo`) centered underneath. No type or series chips and no
 * status icons, unlike `BookCard` - every watchlist card already shares the same ownership, and the type filter
 * above the grid covers that dimension instead. Passed as `description` (not `children`) so the card's explicit
 * `aria-label` does not hide it from screen readers. Every card here is a watchlist book, so the cover is always
 * shown in grayscale at half opacity.
 */
export function WatchlistBookCard({ book, onOpen }: { book: BookResponse; onOpen: (book: BookResponse) => void }) {
  return (
    <MediaCardShell
      title={book.title}
      coverImageUrl={book.coverImageUrl}
      coverAspectRatio={BOOK_COVER_ASPECT_RATIO}
      onClick={() => onOpen(book)}
      desaturateCover={book.ownership === "watchlist"}
      description={<ReleaseInfo releaseDate={book.releaseDate} releaseYear={book.releaseYear} />}
    />
  );
}
