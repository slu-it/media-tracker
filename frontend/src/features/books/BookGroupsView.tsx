import { useMemo, useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { BookResponse } from "../../types/api";
import { MediaViewHeader } from "../../components/media/MediaViewHeader";
import { SearchField } from "../../components/media/SearchField";
import { SECTION_GAP } from "../../components/media/mediaLayout";
import { useLoadOnce } from "../../hooks/useLoadOnce";
import { useSearchDebounceMs } from "../../hooks/useSearchDebounceMs";
import { useUrlSearchInput } from "../../hooks/useUrlSearchInput";
import { useViewParams } from "../../hooks/useViewParams";
import { useBooksMeta } from "./hooks/useBooksMeta";
import { BookDialogsHost } from "./components/BookDialogsHost";
import {
  BookGroupAccordion,
  type BookGroup,
  type BookGroupLabelPrefix,
  type LoadGroupBooks,
  type RenderGroupCard,
} from "./components/BookGroupAccordion";
import { bookGroupViewParams, parseBookGroupViewParams } from "./domain/bookGroupViewParams";
import { filterByName } from "./domain/nameSearch";

interface BookGroupsViewProps {
  /** Must be stable, module-level functions (`useLoadOnce`, `useGroupBooks`). */
  loadSummaries: () => Promise<BookGroup[]>;
  loadBooks: LoadGroupBooks;
  renderCard: RenderGroupCard;
  /** i18n namespace of the grouping's texts (searchLabel, searchPlaceholder, count, bookCount, empty, ...). */
  labelPrefix: BookGroupLabelPrefix;
}

/** Every group (series, author) as an accordion; a section loads its books when expanded. The search filters client-side. */
export function BookGroupsView({ loadSummaries, loadBooks, renderCard, labelPrefix }: BookGroupsViewProps) {
  const { t } = useTranslation();
  const [searchParams, writeParams] = useViewParams();
  const query = searchParams.toString();
  const { search: urlSearch } = useMemo(() => parseBookGroupViewParams(new URLSearchParams(query)), [query]);

  const [searchInput, setSearchInput, flushSearch, clearSearch] = useUrlSearchInput(
    urlSearch,
    (search) => writeParams(() => bookGroupViewParams({ search }), { replace: true }),
    useSearchDebounceMs(),
  );

  const { data: summaries, error, reload: reloadSummaries } = useLoadOnce(loadSummaries, t("errors.loadFailed"));
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);
  const { meta, reload: reloadMeta } = useBooksMeta(t("errors.loadFailed"));
  const [selected, setSelected] = useState<BookResponse | null>(null);

  const visible = useMemo(
    () => (summaries === null ? null : filterByName(summaries, urlSearch)),
    [summaries, urlSearch],
  );

  // A save may change counts, add a group, or move a book between groups (or renumber it in a series): refresh the list and every open section.
  const refresh = () => {
    reloadSummaries();
    reloadMeta();
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
            label={t(`${labelPrefix}.searchLabel`)}
            placeholder={t(`${labelPrefix}.searchPlaceholder`)}
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            onSubmit={flushSearch}
            fullWidth
          />
        }
        count={visible?.length ?? null}
        formatCount={(count) => t(`${labelPrefix}.count`, { count })}
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
        typeCounts={meta?.typeCounts}
      />
      {visible !== null && visible.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
          {urlSearch ? t(`${labelPrefix}.noSearchResults`, { term: urlSearch }) : t(`${labelPrefix}.empty`)}
        </Typography>
      )}
      {visible !== null && visible.length > 0 && (
        <Box sx={{ pt: SECTION_GAP }}>
          {visible.map((group) => (
            <BookGroupAccordion
              key={group.id}
              group={group}
              loadBooks={loadBooks}
              renderCard={renderCard}
              labelPrefix={labelPrefix}
              expanded={openIds.has(group.id)}
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
