import { useMemo, useState } from "react";
import { Alert, Box, Button, Divider, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../types/api";
import { GameDialogsHost } from "./components/GameDialogsHost";
import { GamesGrid } from "./components/GamesGrid";
import { RankingGameCard } from "./components/RankingGameCard";
import { YearNavigator } from "./components/YearNavigator";
import { EMPTY_FILTERS, type GameFilters } from "./domain/gameFilters";
import { currentYear } from "./domain/gameValues";
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
  const [selectedYear, setSelectedYear] = useState(now);
  // Derived rather than synced in an effect (react-hooks/set-state-in-effect): if a reload makes the previous
  // selection disappear from `years` (e.g. the last game of that year was deleted or its release year changed),
  // `resolveRankingYear` falls back on every render instead of a one-off effect correcting the state.
  // `selectedYear` itself is left holding the old, now-unoffered year rather than being corrected to the
  // fallback: if that year later reappears (e.g. its last game's release year is edited back), the view returns
  // to it automatically. This is an accepted, rare edge case, not the common path.
  const year = resolveRankingYear(years, selectedYear, now);
  // Memoized on `year` alone: `useAllGames`'s fetch effect depends on this object's reference, and a fresh
  // literal on every render (e.g. once `meta` arrives) would refetch even though nothing relevant changed.
  const filters: GameFilters = useMemo(() => ({ ...EMPTY_FILTERS, releaseYears: [year] }), [year]);
  const { items, loading, error, reload } = useAllGames("", filters, t("errors.loadFailed"), "rating_desc", true);
  const [selected, setSelected] = useState<GameResponse | null>(null);

  const navigatorTop = (
    <YearNavigator years={years} value={year} onChange={setSelectedYear} ariaLabel={t("games.ranking.navigatorTop")} />
  );
  const navigatorBottom = (
    <YearNavigator
      years={years}
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
      <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>{navigatorTop}</Box>
      <Divider />
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={reload}>{t("common.retry")}</Button>}>
          {error}
        </Alert>
      )}
      {metaError && (
        <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={reloadMeta}>{t("common.retry")}</Button>}>
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
      <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>{navigatorBottom}</Box>
    </Box>
  );
}
