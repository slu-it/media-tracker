import {
  deleteBookSeries,
  mergeBookSeries,
  renameBookSeries,
  listBookSeriesSummaries,
  listSeriesBooks,
} from "./api/booksApi";
import { BookGroupsView } from "./BookGroupsView";
import { BookCard } from "./components/BookCard";
import type { RenderGroupCard } from "./components/BookGroupAccordion";

const renderCard: RenderGroupCard = (book, onClick, series) => (
  <BookCard
    book={book}
    onOpen={onClick}
    seriesPosition={book.series.find((entry) => entry.id === series.id)?.position ?? null}
  />
);

/** Every series as an accordion; a card carries its "#n" position within the series. */
export function BookSeriesView() {
  return (
    <BookGroupsView
      loadSummaries={listBookSeriesSummaries}
      loadBooks={listSeriesBooks}
      deleteGroup={deleteBookSeries}
      renameGroup={renameBookSeries}
      mergeGroup={mergeBookSeries}
      renderCard={renderCard}
      labelPrefix="books.seriesView"
    />
  );
}
