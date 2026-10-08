import type { GameMetaResponse } from "../../../types/api";
import type { GameFilters } from "../domain/gameFilters";
import { FilterRow } from "../../../components/media/filters/FilterRow";
import { GameFilterBar } from "./GameFilterBar";
import { StatusFilterToggles } from "./StatusFilterToggles";

interface OverviewFiltersProps {
  filters: GameFilters;
  onChange: (filters: GameFilters) => void;
  /** `null` while the filter values are still loading. */
  meta: GameMetaResponse | null;
}

/**
 * All four overview filters for the results row (`ResultsBar`'s `facts` slot): the progress and ownership
 * toggle bars, then the platform and release year selects. In a `FilterRow`.
 */
export function OverviewFilters({ filters, onChange, meta }: OverviewFiltersProps) {
  return (
    <FilterRow>
      <StatusFilterToggles filters={filters} onChange={onChange} meta={meta} />
      <GameFilterBar filters={filters} onChange={onChange} meta={meta} />
    </FilterRow>
  );
}
