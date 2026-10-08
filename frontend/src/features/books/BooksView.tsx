import { useMemo, useState } from "react";
import { Alert, Box, Button, Divider } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { BookResponse } from "../../types/api";
import { MediaGrid } from "../../components/media/MediaGrid";
import { MediaViewHeader } from "../../components/media/MediaViewHeader";
import { SearchField } from "../../components/media/SearchField";
import { SECTION_GAP } from "../../components/media/mediaLayout";
import { usePagedActions } from "../../hooks/usePagedActions";
import { useSearchDebounceMs } from "../../hooks/useSearchDebounceMs";
import { useUrlSearchInput } from "../../hooks/useUrlSearchInput";
import { useViewParams } from "../../hooks/useViewParams";
import { BookCard } from "./components/BookCard";
import { BookDialogsHost } from "./components/BookDialogsHost";
import { BookOverviewFilters } from "./components/BookOverviewFilters";
import { hasActiveBookFilters, type BookFilters } from "./domain/bookFilters";
import { BOOKS_PAGE_SIZE, BOOK_COVER_ASPECT_RATIO } from "./domain/bookValues";
import { bookOverviewParams, parseBookOverviewParams } from "./domain/bookViewParams";
import { useBooksMeta } from "./hooks/useBooksMeta";
import { useBooksPage } from "./hooks/useBooksPage";

export function BooksView() {
  const { t } = useTranslation();
  const [searchParams, writeParams] = useViewParams();
  // The URL is the single source of truth for search, filters and page. Parsed once per distinct query string, so
  // `filters` keeps its identity while the query is unchanged and `useBooksPage` does not refetch every render.
  const query = searchParams.toString();
  const {
    search: urlSearch,
    page,
    filters,
  } = useMemo(() => parseBookOverviewParams(new URLSearchParams(query)), [query]);

  // A new search term is a refinement, not a navigation step: replace the entry and return to page 1.
  const [searchInput, setSearchInput, flushSearch, clearSearch] = useUrlSearchInput(
    urlSearch,
    (search) =>
      writeParams((prev) => bookOverviewParams({ ...parseBookOverviewParams(prev), search, page: 1 }), {
        replace: true,
      }),
    useSearchDebounceMs(),
  );

  const setFilters = (next: BookFilters) =>
    writeParams((prev) => bookOverviewParams({ ...parseBookOverviewParams(prev), filters: next, page: 1 }), {
      replace: true,
    });
  // A page change is a navigation step: it pushes, so Back returns to the previous page.
  // The automatic corrections of `usePagedActions` pass `replace` and do not add an entry.
  const setPage = (next: number, { replace = false }: { replace?: boolean } = {}) =>
    writeParams((prev) => bookOverviewParams({ ...parseBookOverviewParams(prev), page: next }), { replace });
  const { data, loading, error, reload } = useBooksPage(
    page,
    BOOKS_PAGE_SIZE,
    urlSearch,
    filters,
    t("errors.loadFailed"),
  );
  const { meta, error: metaError, reload: reloadMeta } = useBooksMeta(t("errors.loadFailed"));
  const [selected, setSelected] = useState<BookResponse | null>(null);
  const { topPagination, pagination, onDeleted, onUpdated } = usePagedActions({
    data,
    loading,
    page,
    setPage,
    reload,
    reloadMeta,
    setSelected,
  });

  return (
    <Box sx={{ pb: 12 }}>
      <MediaViewHeader
        search={
          <SearchField
            label={t("books.search.label")}
            placeholder={t("books.search.placeholder")}
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            onSubmit={flushSearch}
            fullWidth
          />
        }
        count={data?.totalItems ?? null}
        formatCount={(count) => t("books.resultCount", { count })}
        facts={
          // Shown at a count of 0 only when any filter is active, so there is something to undo.
          data?.totalItems !== 0 || hasActiveBookFilters(filters) ? (
            <BookOverviewFilters filters={filters} onChange={setFilters} meta={meta} />
          ) : undefined
        }
        pagination={topPagination}
      />
      {error && (
        <Alert severity="error" sx={{ mt: SECTION_GAP }} action={<Button onClick={reload}>{t("common.retry")}</Button>}>
          {error}
        </Alert>
      )}
      {metaError && (
        <Alert
          severity="error"
          sx={{ mt: SECTION_GAP }}
          action={<Button onClick={reloadMeta}>{t("common.retry")}</Button>}
        >
          {metaError}
        </Alert>
      )}
      <BookDialogsHost
        selected={selected}
        onSelect={setSelected}
        onCreated={onUpdated}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
      <MediaGrid
        items={data?.items ?? null}
        onOpen={setSelected}
        searchTerm={urlSearch}
        filtered={hasActiveBookFilters(filters)}
        renderCard={(book, onClick) => <BookCard book={book} onOpen={onClick} />}
        coverAspectRatio={BOOK_COVER_ASPECT_RATIO}
        messages={{
          empty: t("books.empty"),
          noSearchResults: (term) => t("books.search.noResults", { term }),
          noFilterResults: t("books.filters.noResults"),
        }}
      />
      <Divider />
      {pagination}
    </Box>
  );
}
