import type { RenderGroupCard } from "../../domain/media/groups";
import type { BookResponse } from "../../types/api";
import {
  deleteBookSeries,
  mergeBookSeries,
  renameBookSeries,
  listBookSeriesSummaries,
  listSeriesBooks,
} from "./api/booksApi";
import { BookGroupsView } from "./BookGroupsView";
import { BookCard } from "./components/BookCard";
import { toMediaGroups } from "./domain/bookGroups";

const renderCard: RenderGroupCard<BookResponse> = (book, onClick, series) => (
  <BookCard
    book={book}
    onOpen={onClick}
    seriesPosition={book.series.find((entry) => entry.id === series.id)?.position ?? null}
  />
);
const loadSummaries = () => listBookSeriesSummaries().then(toMediaGroups);

/** Every series as an accordion; a card carries its "#n" position within the series. */
export function BookSeriesView() {
  return (
    <BookGroupsView
      loadSummaries={loadSummaries}
      loadBooks={listSeriesBooks}
      deleteGroup={deleteBookSeries}
      renameGroup={renameBookSeries}
      mergeGroup={mergeBookSeries}
      renderCard={renderCard}
      labelPrefix="books.seriesView"
    />
  );
}
