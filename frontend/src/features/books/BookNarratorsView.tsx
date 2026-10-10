import type { RenderGroupCard } from "../../domain/media/groups";
import type { BookResponse } from "../../types/api";
import {
  deleteBookNarrator,
  mergeBookNarrator,
  renameBookNarrator,
  listBookNarratorSummaries,
  listNarratorBooks,
} from "./api/booksApi";
import { BookGroupsView } from "./BookGroupsView";
import { BookCard } from "./components/BookCard";
import { toMediaGroups } from "./domain/bookGroups";

// The overview card layout: series chips, no series position badge.
const renderCard: RenderGroupCard<BookResponse> = (book, onClick) => <BookCard book={book} onOpen={onClick} />;
const loadSummaries = () => listBookNarratorSummaries().then(toMediaGroups);

/** Every narrator as an accordion; a section loads the narrator's books when expanded. */
export function BookNarratorsView() {
  return (
    <BookGroupsView
      loadSummaries={loadSummaries}
      loadBooks={listNarratorBooks}
      deleteGroup={deleteBookNarrator}
      renameGroup={renameBookNarrator}
      mergeGroup={mergeBookNarrator}
      renderCard={renderCard}
      labelPrefix="books.narratorsView"
    />
  );
}
