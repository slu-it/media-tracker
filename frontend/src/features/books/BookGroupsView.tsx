import { useMemo, useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
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
  /** Deletes an unused group (only offered for groups without books). */
  deleteGroup: (id: string) => Promise<void>;
  /** Renames a group; rejects with an `ApiError` 409 `name_taken` when another group has the name. */
  renameGroup: (id: string, name: string) => Promise<unknown>;
  /** Merges a group into the group `targetId` (the first is removed). */
  mergeGroup: (id: string, targetId: string) => Promise<unknown>;
  /** i18n namespace of the grouping's texts (searchLabel, searchPlaceholder, count, bookCount, empty, ...). */
  labelPrefix: BookGroupLabelPrefix;
}

/** Every group (series, author) as an accordion; a section loads its books when expanded. The search filters client-side. */
export function BookGroupsView({
  loadSummaries,
  loadBooks,
  renderCard,
  deleteGroup,
  renameGroup,
  mergeGroup,
  labelPrefix,
}: BookGroupsViewProps) {
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
  // Merged-away groups: hidden at once, so their (still collapsing) section does not refetch books of a deleted group.
  const [mergedIds, setMergedIds] = useState<ReadonlySet<string>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);
  const { meta, reload: reloadMeta } = useBooksMeta(t("errors.loadFailed"));
  const [selected, setSelected] = useState<BookResponse | null>(null);

  const visible = useMemo(
    () => (summaries === null ? null : filterByName(summaries, urlSearch).filter((g) => !mergedIds.has(g.id))),
    [summaries, urlSearch, mergedIds],
  );

  // A save may change counts, add a group, or move a book between groups (or renumber it in a series): refresh the list and every open section.
  const refresh = () => {
    reloadSummaries();
    reloadMeta();
    setReloadToken((n) => n + 1);
  };
  const onToggle = (id: string, expanded: boolean) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(id);
      else next.delete(id);
      return next;
    });
  const onDeleted = () => {
    setSelected(null);
    refresh();
  };
  const onDeleteGroup = async (id: string) => {
    try {
      await deleteGroup(id);
    } finally {
      // Also after a failure: a 409 (got a book meanwhile) or 404 (already gone) means the list is stale.
      refresh();
    }
  };
  const onRenameGroup = async (id: string, name: string) => {
    try {
      await renameGroup(id, name);
    } catch (cause: unknown) {
      // A taken name changes nothing; any other failure (404 already gone, 5xx) may leave the list stale.
      if (!(cause instanceof ApiError && cause.status === 409 && cause.body?.error === "name_taken")) refresh();
      throw cause;
    }
    refresh();
  };
  const onMergeGroup = async (id: string, targetId: string) => {
    try {
      await mergeGroup(id, targetId);
      // The source is gone: collapse and hide it before the refresh so its section does not refetch its books.
      onToggle(id, false);
      setMergedIds((prev) => new Set(prev).add(id));
    } finally {
      // Also after a failure: a 404 (source or target vanished) means the list is stale.
      refresh();
    }
  };

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
              onRename={onRenameGroup}
              onMerge={onMergeGroup}
              onDelete={onDeleteGroup}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
