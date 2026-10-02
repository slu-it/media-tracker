import { useMemo, useState } from "react";
import { Alert, Box, Button, Divider, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../types/api";
import { GameDialogsHost } from "./components/GameDialogsHost";
import { GameSearchField } from "./components/GameSearchField";
import { GamesGrid } from "./components/GamesGrid";
import { GamesViewHeader } from "./components/GamesViewHeader";
import { SECTION_GAP } from "./components/gamesLayout";
import { FilterSelect } from "./components/GameFilterBar";
import { ReleaseSortToggle } from "./components/ReleaseSortToggle";
import { WatchlistGameCard } from "./components/WatchlistGameCard";
import { EMPTY_FILTERS, type GameFilters } from "./domain/gameFilters";
import { GAMES_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "./domain/gameValues";
import { parseWatchlistParams, watchlistParams, type WatchlistParams } from "./domain/gameViewParams";
import { useGamesMeta } from "./hooks/useGamesMeta";
import { useGamesPage } from "./hooks/useGamesPage";
import { useViewParams } from "./hooks/useViewParams";
import { usePagedGameActions } from "./hooks/usePagedGameActions";
import { useUrlSearchInput } from "./hooks/useUrlSearchInput";

interface GamesWatchlistViewProps {
  /** Same convention as `GamesView`: tests pass a short value to stay on real timers. */
  searchDebounceMs?: number;
}

/** Games on the watchlist (`ownership === "watchlist"`), sorted by release date, oldest or newest first. */
export function GamesWatchlistView({ searchDebounceMs = SEARCH_DEBOUNCE_MS }: GamesWatchlistViewProps = {}) {
  const { t } = useTranslation();
  const [searchParams, writeParams] = useViewParams();
  // The URL is the single source of truth for search, platform filter, sort and page (as in GamesView).
  const query = searchParams.toString();
  const {
    search: urlSearch,
    platformIds,
    sort,
    page,
  } = useMemo(() => parseWatchlistParams(new URLSearchParams(query)), [query]);

  // Search, platform and sort are refinements, not navigation steps: they replace the entry and return to page 1.
  const update = (next: Partial<WatchlistParams>) =>
    writeParams((prev) => watchlistParams({ ...parseWatchlistParams(prev), page: 1, ...next }), { replace: true });
  const [searchInput, setSearchInput, flushSearch] = useUrlSearchInput(
    urlSearch,
    (search) => update({ search }),
    searchDebounceMs,
  );
  // A page change is a navigation step: it pushes, so Back returns to the previous page. The automatic
  // corrections of `usePagedGameActions` pass `replace` and do not add an entry.
  const setPage = (next: number, { replace = false }: { replace?: boolean } = {}) =>
    writeParams((prev) => watchlistParams({ ...parseWatchlistParams(prev), page: next }), { replace });

  // Ownership is fixed to the watchlist and never shown as a filter; only the platform selection is under the
  // user's control here. Memoized on the selection's key: useGamesPage's fetch effect depends on this object
  // directly (not just its key), so it must keep its identity across unrelated renders and query changes (e.g.
  // a page change) that leave the selection alone.
  const platformKey = JSON.stringify(platformIds);
  const filters: GameFilters = useMemo(
    () => ({ ...EMPTY_FILTERS, ownership: ["watchlist"], platformIds: JSON.parse(platformKey) as string[] }),
    [platformKey],
  );
  const { data, loading, error, reload } = useGamesPage(
    page,
    GAMES_PAGE_SIZE,
    urlSearch,
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
    !loading && data !== null && data.items.length === 0 && urlSearch === "" && platformIds.length === 0;

  return (
    <Box sx={{ pb: 12 }}>
      <GamesViewHeader
        controls={
          <>
            <FilterSelect
              label={t("games.filters.platform")}
              options={meta?.platforms.map((platform) => platform.id) ?? []}
              selected={platformIds}
              onChange={(next) => update({ platformIds: next })}
              getOptionLabel={platformLabel}
              disabled={metaLoading}
              fullWidth
            />
            <ReleaseSortToggle value={sort} onChange={(next) => update({ sort: next })} fullWidth />
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
          searchTerm={urlSearch}
          filtered={platformIds.length > 0}
          renderCard={(game, onClick) => <WatchlistGameCard game={game} onOpen={onClick} />}
        />
      )}
      <Divider />
      {pagination}
    </Box>
  );
}
