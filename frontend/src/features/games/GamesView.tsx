import { useMemo, useState } from "react";
import { Alert, Box, Button, Divider } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../types/api";
import { GameDialogsHost } from "./components/GameDialogsHost";
import { SearchField } from "../../components/media/SearchField";
import { GamesGrid } from "./components/GamesGrid";
import { OverviewFilters } from "./components/OverviewFilters";
import { MediaViewHeader } from "../../components/media/MediaViewHeader";
import { SECTION_GAP } from "../../components/media/mediaLayout";
import { hasActiveFilters, type GameFilters } from "./domain/gameFilters";
import { GAMES_PAGE_SIZE } from "./domain/gameValues";
import { overviewParams, parseOverviewParams } from "./domain/gameViewParams";
import { useGamesMeta } from "./hooks/useGamesMeta";
import { useGamesPage } from "./hooks/useGamesPage";
import { useViewParams } from "../../hooks/useViewParams";
import { usePagedActions } from "../../hooks/usePagedActions";
import { useSearchDebounceMs } from "../../hooks/useSearchDebounceMs";
import { useUrlSearchInput } from "../../hooks/useUrlSearchInput";

export function GamesView() {
  const { t } = useTranslation();
  const [searchParams, writeParams] = useViewParams();
  // The URL is the single source of truth for search, filters and page. Parsed once per distinct query string, so
  // `filters` keeps its identity while the query is unchanged and `useGamesPage` does not refetch every render.
  const query = searchParams.toString();
  const { search: urlSearch, page, filters } = useMemo(() => parseOverviewParams(new URLSearchParams(query)), [query]);

  // A new search term is a refinement, not a navigation step: replace the entry and return to page 1.
  const [searchInput, setSearchInput, flushSearch, clearSearch] = useUrlSearchInput(
    urlSearch,
    (search) =>
      writeParams((prev) => overviewParams({ ...parseOverviewParams(prev), search, page: 1 }), { replace: true }),
    useSearchDebounceMs(),
  );

  const setFilters = (next: GameFilters) =>
    writeParams((prev) => overviewParams({ ...parseOverviewParams(prev), filters: next, page: 1 }), {
      replace: true,
    });
  // A page change is a navigation step: it pushes, so Back returns to the previous page.
  // The automatic corrections of `usePagedActions` pass `replace` and do not add an entry.
  const setPage = (next: number, { replace = false }: { replace?: boolean } = {}) =>
    writeParams((prev) => overviewParams({ ...parseOverviewParams(prev), page: next }), { replace });
  const { data, loading, error, reload } = useGamesPage(
    page,
    GAMES_PAGE_SIZE,
    urlSearch,
    filters,
    t("errors.loadFailed"),
  );
  const { meta, error: metaError, reload: reloadMeta } = useGamesMeta(t("errors.loadFailed"));
  const [selected, setSelected] = useState<GameResponse | null>(null);
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
            label={t("games.search.label")}
            placeholder={t("games.search.placeholder")}
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            onSubmit={flushSearch}
            fullWidth
          />
        }
        count={data?.totalItems ?? null}
        formatCount={(count) => t("games.resultCount", { count })}
        facts={
          // Shown at a count of 0 only when any filter is active, so there is something to undo.
          data?.totalItems !== 0 || hasActiveFilters(filters) ? (
            <OverviewFilters filters={filters} onChange={setFilters} meta={meta} />
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
      <GameDialogsHost
        selected={selected}
        onSelect={setSelected}
        onCreated={onUpdated}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
      <GamesGrid
        games={data?.items ?? null}
        onOpen={setSelected}
        searchTerm={urlSearch}
        filtered={hasActiveFilters(filters)}
      />
      <Divider />
      {pagination}
    </Box>
  );
}
