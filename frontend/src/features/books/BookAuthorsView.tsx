import type { RenderGroupCard } from "../../domain/media/groups";
import type { BookResponse } from "../../types/api";
import {
  deleteBookAuthor,
  mergeBookAuthor,
  renameBookAuthor,
  listAuthorBooks,
  listBookAuthorSummaries,
} from "./api/booksApi";
import { BookGroupsView } from "./BookGroupsView";
import { BookCard } from "./components/BookCard";
import { toMediaGroups } from "./domain/bookGroups";

// The overview card layout: series chips, no series position badge.
const renderCard: RenderGroupCard<BookResponse> = (book, onClick) => <BookCard book={book} onOpen={onClick} />;
const loadSummaries = () => listBookAuthorSummaries().then(toMediaGroups);

/** Every author as an accordion; a section loads the author's books when expanded. */
export function BookAuthorsView() {
  return (
    <BookGroupsView
      loadSummaries={loadSummaries}
      loadBooks={listAuthorBooks}
      deleteGroup={deleteBookAuthor}
      renameGroup={renameBookAuthor}
      mergeGroup={mergeBookAuthor}
      renderCard={renderCard}
      labelPrefix="books.authorsView"
    />
  );
}
