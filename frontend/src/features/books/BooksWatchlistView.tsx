import { useMemo, useState } from "react";
import { Alert, Box, Button, Divider, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { BookResponse } from "../../types/api";
import { MediaGrid } from "../../components/media/MediaGrid";
import { MediaViewHeader } from "../../components/media/MediaViewHeader";
import { ReleaseSortToggle } from "../../components/media/ReleaseSortToggle";
import { SearchField } from "../../components/media/SearchField";
import { SECTION_GAP } from "../../components/media/mediaLayout";
import { FILTER_SELECT_SX } from "../../components/media/filters/filterLayout";
import { FilterRow } from "../../components/media/filters/FilterRow";
import { FilterSelect } from "../../components/media/filters/FilterSelect";
import { usePagedActions } from "../../hooks/usePagedActions";
import { useSearchDebounceMs } from "../../hooks/useSearchDebounceMs";
import { useUrlSearchInput } from "../../hooks/useUrlSearchInput";
import { useViewParams } from "../../hooks/useViewParams";
import { BookDialogsHost } from "./components/BookDialogsHost";
import { WatchlistBookCard } from "./components/WatchlistBookCard";
import { EMPTY_BOOK_FILTERS, type BookFilters } from "./domain/bookFilters";
import { BOOKS_PAGE_SIZE, BOOK_COVER_ASPECT_RATIO } from "./domain/bookValues";
import { bookWatchlistParams, parseBookWatchlistParams, type BookWatchlistParams } from "./domain/bookViewParams";
import { useBooksMeta } from "./hooks/useBooksMeta";
import { useBooksPage } from "./hooks/useBooksPage";

/** Books on the watchlist (`ownership === "watchlist"`), sorted by release date, oldest or newest first. */
export function BooksWatchlistView() {
  const { t } = useTranslation();
  const [searchParams, writeParams] = useViewParams();
  // The URL is the single source of truth for search, type filter, sort and page (as in BooksView).
  const query = searchParams.toString();
  const {
    search: urlSearch,
    typeIds,
    sort,
    page,
  } = useMemo(() => parseBookWatchlistParams(new URLSearchParams(query)), [query]);

  // Search, type and sort are refinements, not navigation steps: they replace the entry and return to page 1.
  const update = (next: Partial<BookWatchlistParams>) =>
    writeParams((prev) => bookWatchlistParams({ ...parseBookWatchlistParams(prev), page: 1, ...next }), {
      replace: true,
    });
  const [searchInput, setSearchInput, flushSearch, clearSearch] = useUrlSearchInput(
    urlSearch,
    (search) => update({ search }),
    useSearchDebounceMs(),
  );
  // A page change is a navigation step: it pushes, so Back returns to the previous page. The automatic
  // corrections of `usePagedActions` pass `replace` and do not add an entry.
  const setPage = (next: number, { replace = false }: { replace?: boolean } = {}) =>
    writeParams((prev) => bookWatchlistParams({ ...parseBookWatchlistParams(prev), page: next }), { replace });

  // Ownership is fixed to the watchlist and never shown as a filter; only the type selection is under the user's
  // control here. Memoized on the selection's key: useBooksPage's fetch effect depends on this object directly,
  // so it must keep its identity across unrelated renders and query changes (e.g. a page change).
  const typeKey = JSON.stringify(typeIds);
  const filters: BookFilters = useMemo(
    () => ({ ...EMPTY_BOOK_FILTERS, ownership: ["watchlist"], typeIds: JSON.parse(typeKey) as string[] }),
    [typeKey],
  );
  const { data, loading, error, reload } = useBooksPage(
    page,
    BOOKS_PAGE_SIZE,
    urlSearch,
    filters,
    t("errors.loadFailed"),
    sort,
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

  const typeLabel = (id: string) => meta?.types.find((type) => type.id === id)?.label ?? id;
  // "Nothing on the watchlist at all" is a distinct message from "no result for this search/filter". `!loading`
  // avoids a flash of this message while a still-loading page's stale data momentarily satisfies the other
  // conditions, e.g. right after clearing a zero-result search.
  const whollyEmpty = !loading && data !== null && data.items.length === 0 && urlSearch === "" && typeIds.length === 0;

  return (
    <Box sx={{ pb: 12 }}>
      <MediaViewHeader
        facts={
          // Hidden only for a watchlist without a single book; a type filter without results stays visible so it
          // can be undone (the sort never causes zero results).
          data?.totalItems !== 0 || typeIds.length > 0 ? (
            <FilterRow>
              <ReleaseSortToggle value={sort} onChange={(next) => update({ sort: next })} />
              <FilterSelect
                label={t("books.filters.type")}
                options={meta?.types.map((type) => type.id) ?? []}
                selected={typeIds}
                onChange={(next) => update({ typeIds: next })}
                getOptionLabel={typeLabel}
                disabled={meta === null}
                variant="standard"
                labelStyle="legend"
                sx={FILTER_SELECT_SX}
              />
            </FilterRow>
          ) : undefined
        }
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
      {whollyEmpty ? (
        <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
          {t("books.watchlist.empty")}
        </Typography>
      ) : (
        <MediaGrid
          items={data?.items ?? null}
          onOpen={setSelected}
          searchTerm={urlSearch}
          filtered={typeIds.length > 0}
          renderCard={(book, onClick) => <WatchlistBookCard book={book} onOpen={onClick} />}
          coverAspectRatio={BOOK_COVER_ASPECT_RATIO}
          messages={{
            empty: t("books.empty"),
            noSearchResults: (term) => t("books.search.noResults", { term }),
            noFilterResults: t("books.filters.noResults"),
          }}
        />
      )}
      <Divider />
      {pagination}
    </Box>
  );
}
