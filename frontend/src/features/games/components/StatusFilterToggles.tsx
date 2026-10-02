import { useTranslation } from "react-i18next";
import type { GameMetaResponse } from "../../../types/api";
import type { GameFilters } from "../domain/gameFilters";
import { OWNERSHIP_VALUES, PROGRESS_VALUES } from "../domain/gameStatus";
import { LEGEND_GAP_SX } from "./fields/legendGap";
import { OWNERSHIP_ICONS } from "./ownershipIcons";
import { PROGRESS_ICONS } from "./progressIcons";
import { StatusToggleBar } from "./StatusToggleBar";

interface StatusFilterTogglesProps {
  filters: GameFilters;
  onChange: (filters: GameFilters) => void;
  /** `null` while the filter values are still loading; nothing is dimmed then. */
  meta: GameMetaResponse | null;
}

/**
 * 32px high and roughly square: a small icon is 20px, plus 5px padding and the 1px border on each side. This
 * matches the count chip and the default `Pagination` page buttons next to it in the results row.
 */
const BUTTON_SX = { p: "5px", minWidth: 32, height: 32 } as const;

/**
 * The progress and ownership filters as two multi-select icon toggle groups for the results row, each with a visible
 * label above it. Renders a fragment, so both bars are direct items of the flex row they are placed in. Nothing pressed
 * means no filter on that field. A value that no stored game has (per `meta`) is dimmed (with a "no games" hint) but stays clickable.
 */
export function StatusFilterToggles({ filters, onChange, meta }: StatusFilterTogglesProps) {
  const { t } = useTranslation();
  return (
    <>
      <StatusToggleBar
        multiple
        values={PROGRESS_VALUES}
        icons={PROGRESS_ICONS}
        getLabel={(value) => t(`games.progress.${value}`)}
        groupLabel={t("games.filters.progress")}
        value={filters.progress}
        onChange={(progress) => onChange({ ...filters, progress })}
        dimmed={(value) => meta !== null && !meta.progress.includes(value)}
        dimmedHint={t("games.filters.noGames")}
        showLabel
        buttonSx={BUTTON_SX}
        legendSx={LEGEND_GAP_SX}
      />
      <StatusToggleBar
        multiple
        values={OWNERSHIP_VALUES}
        icons={OWNERSHIP_ICONS}
        getLabel={(value) => t(`games.ownership.${value}`)}
        groupLabel={t("games.filters.ownership")}
        value={filters.ownership}
        onChange={(ownership) => onChange({ ...filters, ownership })}
        dimmed={(value) => meta !== null && !meta.ownership.includes(value)}
        dimmedHint={t("games.filters.noGames")}
        showLabel
        buttonSx={BUTTON_SX}
        legendSx={LEGEND_GAP_SX}
      />
    </>
  );
}
