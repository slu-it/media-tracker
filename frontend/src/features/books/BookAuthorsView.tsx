import { listAuthorBooks, listBookAuthorSummaries } from "./api/booksApi";
import { BookGroupsView } from "./BookGroupsView";
import { BookCard } from "./components/BookCard";
import type { RenderGroupCard } from "./components/BookGroupAccordion";

// The overview card layout: series chips, no series position badge.
const renderCard: RenderGroupCard = (book, onClick) => <BookCard book={book} onOpen={onClick} />;

/** Every author as an accordion; a section loads the author's books when expanded. */
export function BookAuthorsView() {
  return (
    <BookGroupsView
      loadSummaries={listBookAuthorSummaries}
      loadBooks={listAuthorBooks}
      renderCard={renderCard}
      labelPrefix="books.authorsView"
    />
  );
}
