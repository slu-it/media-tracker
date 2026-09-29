import { useMemo, useState } from "react";
import { Alert, Box, Button, Divider, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GameResponse, GameSort } from "../../types/api";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { GameDialogsHost } from "./components/GameDialogsHost";
import { GameSearchField } from "./components/GameSearchField";
import { GamesGrid } from "./components/GamesGrid";
import { GamesViewHeader } from "./components/GamesViewHeader";
import { SECTION_GAP } from "./components/gamesLayout";
import { FilterSelect } from "./components/GameFilterBar";
import { ReleaseSortToggle } from "./components/ReleaseSortToggle";
import { WatchlistGameCard } from "./components/WatchlistGameCard";
import { EMPTY_FILTERS, filtersKey, type GameFilters } from "./domain/gameFilters";
import { GAMES_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "./domain/gameValues";
import { useGamesMeta } from "./hooks/useGamesMeta";
import { useGamesPage } from "./hooks/useGamesPage";
import { usePagedGameActions } from "./hooks/usePagedGameActions";

interface GamesWatchlistViewProps {
  /** Same convention as `GamesView`: tests pass a short value to stay on real timers. */
  searchDebounceMs?: number;
}

const DEFAULT_SORT: GameSort = "release_asc";

/** Games on the watchlist (`ownership === "watchlist"`), sorted by release date, oldest or newest first. */
export function GamesWatchlistView({ searchDebounceMs = SEARCH_DEBOUNCE_MS }: GamesWatchlistViewProps = {}) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, flushSearch] = useDebouncedValue(searchInput.trim(), searchDebounceMs);
  const [platformIds, setPlatformIds] = useState<string[]>([]);
  // Ownership is fixed to the watchlist and never shown as a filter; only the platform selection is under the
  // user's control here. Memoized so its identity only changes with platformIds: useGamesPage's fetch effect
  // depends on this object directly (not just its key), and a fresh literal on every render would refetch on
  // every unrelated re-render (e.g. once the meta payload arrives).
  const filters: GameFilters = useMemo(
    () => ({ ...EMPTY_FILTERS, ownership: ["watchlist"], platformIds }),
    [platformIds],
  );
  const filtersValue = filtersKey(filters);
  const [sort, setSort] = useState<GameSort>(DEFAULT_SORT);
  // Paging is stored together with the search term, filter selection and sort it was chosen for (as in
  // GamesView), extended with sort: any of the three evaluates to page 1 in the same render.
  const [paging, setPaging] = useState({
    page: 1,
    search: "",
    filters: filtersKey({ ...EMPTY_FILTERS, ownership: ["watchlist"] }),
    sort: DEFAULT_SORT,
  });
  const page =
    paging.search === debouncedSearch && paging.filters === filtersValue && paging.sort === sort ? paging.page : 1;
  const setPage = (next: number) => setPaging({ page: next, search: debouncedSearch, filters: filtersValue, sort });
  const { data, loading, error, reload } = useGamesPage(
    page,
    GAMES_PAGE_SIZE,
    debouncedSearch,
    filters,
    t("errors.loadFailed"),
    sort,
  );
  const { meta, error: metaError, reload: reloadMeta } = useGamesMeta(t("errors.loadFailed"));
  const [selected, setSelected] = useState<GameResponse | null>(null);
  const { topPagination, pagination, onDeleted, onUpdated } = usePagedGameActions({
    data,
    loading,
    page,
    setPage,
    reload,
    reloadMeta,
    setSelected,
  });

  const platformLabel = (id: string) => meta?.platforms.find((platform) => platform.id === id)?.label ?? id;
  const metaLoading = meta === null;
  // "Nothing on the watchlist at all" is a distinct message from "no result for this search/filter"; only the
  // former default-empties to the watchlist's own copy, the latter two reuse GamesGrid's search/filter wording.
  // `!loading` avoids a flash of this message while a still-loading page's stale (already filtered-out) data
  // momentarily satisfies the other conditions, e.g. right after clearing a zero-result search.
  const whollyEmpty =
    !loading && data !== null && data.items.length === 0 && debouncedSearch === "" && platformIds.length === 0;

  return (
    <Box sx={{ pb: 12 }}>
      <GamesViewHeader
        controls={
          <>
            <FilterSelect
              label={t("games.filters.platform")}
              options={meta?.platforms.map((platform) => platform.id) ?? []}
              selected={platformIds}
              onChange={setPlatformIds}
              getOptionLabel={platformLabel}
              disabled={metaLoading}
              fullWidth
            />
            <ReleaseSortToggle value={sort} onChange={setSort} fullWidth />
          </>
        }
        controlsLayout="half"
        search={
          <GameSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={() => setSearchInput("")}
            onSubmit={flushSearch}
            fullWidth
          />
        }
        count={data?.totalItems ?? null}
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
      {whollyEmpty ? (
        <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
          {t("games.watchlist.empty")}
        </Typography>
      ) : (
        <GamesGrid
          games={data?.items ?? null}
          onOpen={setSelected}
          searchTerm={debouncedSearch}
          filtered={platformIds.length > 0}
          renderCard={(game, onClick) => <WatchlistGameCard game={game} onOpen={onClick} />}
        />
      )}
      <Divider />
      {pagination}
    </Box>
  );
}
