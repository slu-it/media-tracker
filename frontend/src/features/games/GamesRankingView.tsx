import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Alert, Box, Button, Divider, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../types/api";
import { GameDialogsHost } from "./components/GameDialogsHost";
import { GamesGrid } from "./components/GamesGrid";
import { MediaViewHeader } from "../../components/media/MediaViewHeader";
import { RankingGameCard } from "./components/RankingGameCard";
import { SECTION_GAP } from "../../components/media/mediaLayout";
import { YearNavigator } from "./components/YearNavigator";
import { EMPTY_FILTERS, type GameFilters } from "./domain/gameFilters";
import { currentYear } from "../../domain/media/values";
import { parseRankingParams, rankingParams } from "./domain/gameViewParams";
import { rankingYears, resolveRankingYear } from "./domain/rankingYears";
import { useAllGames } from "./hooks/useAllGames";
import { useGamesMeta } from "./hooks/useGamesMeta";

/**
 * Yearly ranking: every rated game of one release year, ordered by star rating (backend `sort=rating_desc`,
 * `rated=true` excludes unrated games entirely). No search, filters or pagination - the whole point is a single
 * ranked list per year, navigated with the `YearNavigator` above and below the grid.
 */
export function GamesRankingView() {
  const { t } = useTranslation();
  const { meta, error: metaError, reload: reloadMeta } = useGamesMeta(t("errors.loadFailed"));
  const now = currentYear();
  const years = useMemo(() => rankingYears(meta?.releaseYears ?? [], now), [meta, now]);
  const [searchParams, setSearchParams] = useSearchParams();
  // `null` = no (valid) year in the URL; the default is never written back into it on load.
  const { year: selectedYear } = parseRankingParams(searchParams);
  // A year change is a navigation step: it pushes, so Back returns to the previous year.
  const setSelectedYear = (next: number) => setSearchParams(rankingParams({ year: next }));
  // Derived rather than synced in an effect (react-hooks/set-state-in-effect): if a reload makes the previous
  // selection disappear from `years` (e.g. the last game of that year was deleted or its release year changed),
  // `resolveRankingYear` falls back on every render instead of a one-off effect correcting the state.
  // The URL keeps holding the old, now-unoffered year rather than being corrected to the fallback: if that
  // year later reappears (e.g. its last game's release year is edited back), the view returns to it
  // automatically. This is an accepted, rare edge case, not the common path.
  // While `meta` is still loading nothing is known about the offered years, so a deep-linked year is requested
  // as is instead of first fetching (and flashing) the current year.
  const year = meta === null ? (selectedYear ?? now) : resolveRankingYear(years, selectedYear ?? now, now);
  // Until `meta` arrives the deep-linked year is the only known one; keeps the select's value among its options.
  const navigatorYears = meta === null ? [year] : years;
  // Memoized on `year` alone: `useAllGames`'s fetch effect depends on this object's reference, and a fresh
  // literal on every render (e.g. once `meta` arrives) would refetch even though nothing relevant changed.
  const filters: GameFilters = useMemo(() => ({ ...EMPTY_FILTERS, releaseYears: [year] }), [year]);
  const { items, loading, error, reload } = useAllGames("", filters, t("errors.loadFailed"), "rating_desc", true);
  const [selected, setSelected] = useState<GameResponse | null>(null);

  const navigatorTop = (
    <YearNavigator
      years={navigatorYears}
      value={year}
      onChange={setSelectedYear}
      ariaLabel={t("games.ranking.navigatorTop")}
    />
  );
  const navigatorBottom = (
    <YearNavigator
      years={navigatorYears}
      value={year}
      onChange={setSelectedYear}
      ariaLabel={t("games.ranking.navigatorBottom")}
    />
  );

  const onDeleted = () => {
    setSelected(null);
    reload();
    reloadMeta();
  };

  const onUpdated = () => {
    reload();
    reloadMeta();
  };

  return (
    <Box sx={{ pb: 12 }}>
      <MediaViewHeader
        controls={navigatorTop}
        count={loading ? null : (items?.length ?? null)}
        formatCount={(count) => t("games.resultCount", { count })}
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
        platformCounts={meta?.platformCounts}
        selected={selected}
        onSelect={setSelected}
        onCreated={onUpdated}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
      {!loading && items !== null && items.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
          {t("games.ranking.empty", { year })}
        </Typography>
      ) : (
        <GamesGrid
          // `null` (the skeleton state) while a new year loads, instead of the previous year's still-loaded
          // items: those would otherwise flash under the already-updated year label/navigator selection.
          games={loading ? null : items}
          onOpen={setSelected}
          renderCard={(game, onClick) => <RankingGameCard game={game} onOpen={onClick} />}
        />
      )}
      <Divider />
      <Box sx={{ display: "flex", justifyContent: "center", pt: SECTION_GAP }}>{navigatorBottom}</Box>
    </Box>
  );
}
