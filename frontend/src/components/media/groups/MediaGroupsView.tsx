import { useMemo, useState, type ReactNode } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../api/client";
import { MediaViewHeader } from "../MediaViewHeader";
import { SearchField } from "../SearchField";
import { SECTION_GAP } from "../mediaLayout";
import { useLoadOnce } from "../../../hooks/useLoadOnce";
import { useSearchDebounceMs } from "../../../hooks/useSearchDebounceMs";
import { useUrlSearchInput } from "../../../hooks/useUrlSearchInput";
import { useViewParams } from "../../../hooks/useViewParams";
import { groupViewParams, parseGroupViewParams } from "../../../domain/media/groupViewParams";
import { filterByName } from "../../../domain/media/nameSearch";
import type { GroupLabels, LoadGroupItems, MediaGroup, RenderGroupCard } from "../../../domain/media/groups";
import { MediaGroupAccordion } from "./MediaGroupAccordion";

interface DialogsContext<T> {
  selected: T | null;
  onSelect: (item: T | null) => void;
  /** Refreshes the list, the open sections and the kind's meta (after a create or update). */
  refresh: () => void;
  /** Closes the detail dialog and refreshes. */
  onDeleted: () => void;
}

interface MediaGroupsViewProps<T extends { id: string }> {
  /** Must be stable, module-level functions (`useLoadOnce`, `useGroupItems`). */
  loadSummaries: () => Promise<MediaGroup[]>;
  loadItems: LoadGroupItems<T>;
  renderCard: RenderGroupCard<T>;
  coverAspectRatio: number;
  /** Deletes an unused group (only offered for groups without items). */
  deleteGroup: (id: string) => Promise<void>;
  /** Renames a group; rejects with an `ApiError` 409 `name_taken` when another group has the name. */
  renameGroup: (id: string, name: string) => Promise<unknown>;
  /** Merges a group into the group `targetId` (the first is removed). */
  mergeGroup: (id: string, targetId: string) => Promise<unknown>;
  labels: GroupLabels;
  /** Reloads the kind's meta (counts of the add button); called on every refresh. Must be stable or not matter. */
  onRefresh?: () => void;
  /** The kind's dialogs host (detail dialog, add button), wired to the shared selection and refresh. */
  renderDialogs: (context: DialogsContext<T>) => ReactNode;
}

/** Every group as an accordion; a section loads its items when expanded. The search filters client-side. */
export function MediaGroupsView<T extends { id: string }>({
  loadSummaries,
  loadItems,
  renderCard,
  coverAspectRatio,
  deleteGroup,
  renameGroup,
  mergeGroup,
  labels,
  onRefresh,
  renderDialogs,
}: MediaGroupsViewProps<T>) {
  const { t } = useTranslation();
  const [searchParams, writeParams] = useViewParams();
  const query = searchParams.toString();
  const { search: urlSearch } = useMemo(() => parseGroupViewParams(new URLSearchParams(query)), [query]);

  const [searchInput, setSearchInput, flushSearch, clearSearch] = useUrlSearchInput(
    urlSearch,
    (search) => writeParams(() => groupViewParams({ search }), { replace: true }),
    useSearchDebounceMs(),
  );

  const { data: summaries, error, reload: reloadSummaries } = useLoadOnce(loadSummaries, t("errors.loadFailed"));
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  // Merged-away groups: hidden at once, so their (still collapsing) section does not refetch books of a deleted group.
  const [mergedIds, setMergedIds] = useState<ReadonlySet<string>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);
  const [selected, setSelected] = useState<T | null>(null);

  const visible = useMemo(
    () => (summaries === null ? null : filterByName(summaries, urlSearch).filter((g) => !mergedIds.has(g.id))),
    [summaries, urlSearch, mergedIds],
  );

  // A save may change counts, add a group, or move an item between groups (or renumber it in a series): refresh the list and every open section.
  const refresh = () => {
    reloadSummaries();
    onRefresh?.();
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
            label={labels.searchLabel}
            placeholder={labels.searchPlaceholder}
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            onSubmit={flushSearch}
            fullWidth
          />
        }
        count={visible?.length ?? null}
        formatCount={labels.count}
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
      {renderDialogs({ selected, onSelect: setSelected, refresh, onDeleted })}
      {visible !== null && visible.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
          {urlSearch ? labels.noSearchResults(urlSearch) : labels.empty}
        </Typography>
      )}
      {visible !== null && visible.length > 0 && (
        <Box sx={{ pt: SECTION_GAP }}>
          {visible.map((group) => (
            <MediaGroupAccordion
              key={group.id}
              group={group}
              loadItems={loadItems}
              renderCard={renderCard}
              coverAspectRatio={coverAspectRatio}
              labels={labels}
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
