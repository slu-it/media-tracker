import type { BookResponse } from "../../../types/api";
import { MediaCardShell } from "../../../components/media/MediaCardShell";
import { ColorChips } from "../../../components/media/ColorChips";
import { BOOK_COVER_ASPECT_RATIO } from "../domain/bookValues";
import { BookStatusIcons } from "./BookStatusIcons";

/** Cover with the title centered underneath; the whole card opens the detail dialog. */
export function BookCard({ book, onOpen }: { book: BookResponse; onOpen: (book: BookResponse) => void }) {
  return (
    <MediaCardShell
      title={book.title}
      coverImageUrl={book.coverImageUrl}
      coverAspectRatio={BOOK_COVER_ASPECT_RATIO}
      onClick={() => onOpen(book)}
    >
      {book.types.length > 0 && <ColorChips items={book.types} />}
      <BookStatusIcons ownership={book.ownership} progress={book.progress} variant="card" />
    </MediaCardShell>
  );
}
