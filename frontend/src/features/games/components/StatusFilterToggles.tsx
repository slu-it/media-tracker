import { useTranslation } from "react-i18next";
import { StatusFilterBar } from "../../../components/media/status/StatusFilterBar";
import type { GameMetaResponse } from "../../../types/api";
import type { GameFilters } from "../domain/gameFilters";
import { OWNERSHIP_VALUES, PROGRESS_VALUES } from "../domain/gameStatus";
import { OWNERSHIP_ICONS } from "./ownershipIcons";
import { PROGRESS_ICONS } from "./progressIcons";

interface StatusFilterTogglesProps {
  filters: GameFilters;
  onChange: (filters: GameFilters) => void;
  /** `null` while the filter values are still loading; nothing is dimmed then. */
  meta: GameMetaResponse | null;
}

/**
 * The progress and ownership filters as two multi-select icon toggle groups for the results row, each with a visible
 * label above it. Renders a fragment, so both bars are direct items of the flex row they are placed in. Nothing pressed
 * means no filter on that field. A value that no stored game has (per `meta`) is dimmed (with a "no games" hint) but stays clickable.
 */
export function StatusFilterToggles({ filters, onChange, meta }: StatusFilterTogglesProps) {
  const { t } = useTranslation();
  return (
    <>
      <StatusFilterBar
        values={PROGRESS_VALUES}
        icons={PROGRESS_ICONS}
        getLabel={(value) => t(`games.progress.${value}`)}
        groupLabel={t("media.filters.progress")}
        value={filters.progress}
        onChange={(progress) => onChange({ ...filters, progress })}
        available={meta?.progress ?? null}
        dimmedHint={t("games.filters.noGames")}
      />
      <StatusFilterBar
        values={OWNERSHIP_VALUES}
        icons={OWNERSHIP_ICONS}
        getLabel={(value) => t(`games.ownership.${value}`)}
        groupLabel={t("media.filters.ownership")}
        value={filters.ownership}
        onChange={(ownership) => onChange({ ...filters, ownership })}
        available={meta?.ownership ?? null}
        dimmedHint={t("games.filters.noGames")}
      />
    </>
  );
}
