import { useMemo, useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { BookResponse } from "../../types/api";
import { MediaViewHeader } from "../../components/media/MediaViewHeader";
import { SearchField } from "../../components/media/SearchField";
import { SECTION_GAP } from "../../components/media/mediaLayout";
import { useSearchDebounceMs } from "../../hooks/useSearchDebounceMs";
import { useUrlSearchInput } from "../../hooks/useUrlSearchInput";
import { useViewParams } from "../../hooks/useViewParams";
import { BookDialogsHost } from "./components/BookDialogsHost";
import { BookSeriesAccordion } from "./components/BookSeriesAccordion";
import { bookSeriesViewParams, parseBookSeriesViewParams } from "./domain/bookSeriesViewParams";
import { filterSeriesByName } from "./domain/seriesSearch";
import { useBookSeriesSummaries } from "./hooks/useBookSeriesSummaries";

/** Every series as an accordion; a section loads its books when expanded. The search filters client-side. */
export function BookSeriesView() {
  const { t } = useTranslation();
  const [searchParams, writeParams] = useViewParams();
  const query = searchParams.toString();
  const { search: urlSearch } = useMemo(() => parseBookSeriesViewParams(new URLSearchParams(query)), [query]);

  const [searchInput, setSearchInput, flushSearch, clearSearch] = useUrlSearchInput(
    urlSearch,
    (search) => writeParams(() => bookSeriesViewParams({ search }), { replace: true }),
    useSearchDebounceMs(),
  );

  const { summaries, error, reload: reloadSummaries } = useBookSeriesSummaries(t("errors.loadFailed"));
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);
  const [selected, setSelected] = useState<BookResponse | null>(null);

  const visible = useMemo(
    () => (summaries === null ? null : filterSeriesByName(summaries, urlSearch)),
    [summaries, urlSearch],
  );

  // A save may change counts, add a series, or move/renumber a book: refresh the list and every open section.
  const refresh = () => {
    reloadSummaries();
    setReloadToken((n) => n + 1);
  };
  const onDeleted = () => {
    setSelected(null);
    refresh();
  };
  const onToggle = (id: string, expanded: boolean) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Box sx={{ pb: 12 }}>
      <MediaViewHeader
        search={
          <SearchField
            label={t("books.seriesView.searchLabel")}
            placeholder={t("books.seriesView.searchPlaceholder")}
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            onSubmit={flushSearch}
            fullWidth
          />
        }
        count={visible?.length ?? null}
        formatCount={(count) => t("books.seriesView.count", { count })}
      />
      {error && (
        <Alert
          severity="error"
          sx={{ mt: SECTION_GAP }}
          action={<Button onClick={reloadSummaries}>{t("common.retry")}</Button>}
        >
          {error}
        </Alert>
      )}
      <BookDialogsHost
        selected={selected}
        onSelect={setSelected}
        onCreated={refresh}
        onUpdated={refresh}
        onDeleted={onDeleted}
      />
      {visible !== null && visible.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
          {urlSearch ? t("books.seriesView.noSearchResults", { term: urlSearch }) : t("books.seriesView.empty")}
        </Typography>
      )}
      {visible !== null && visible.length > 0 && (
        <Box sx={{ pt: SECTION_GAP }}>
          {visible.map((series) => (
            <BookSeriesAccordion
              key={series.id}
              series={series}
              expanded={openIds.has(series.id)}
              onToggle={onToggle}
              reloadToken={reloadToken}
              onOpen={setSelected}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
