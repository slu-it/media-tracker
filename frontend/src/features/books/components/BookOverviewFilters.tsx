import type { BookMetaResponse } from "../../../types/api";
import type { BookFilters } from "../domain/bookFilters";
import { FilterRow } from "../../../components/media/filters/FilterRow";
import { BookFilterBar } from "./BookFilterBar";
import { BookStatusFilterToggles } from "./BookStatusFilterToggles";

interface BookOverviewFiltersProps {
  filters: BookFilters;
  onChange: (filters: BookFilters) => void;
  /** `null` while the filter values are still loading. */
  meta: BookMetaResponse | null;
}

/**
 * All four overview filters for the results row (`ResultsBar`'s `facts` slot): the progress and ownership
 * toggle bars, then the type and release year selects. In a `FilterRow`.
 */
export function BookOverviewFilters({ filters, onChange, meta }: BookOverviewFiltersProps) {
  return (
    <FilterRow>
      <BookStatusFilterToggles filters={filters} onChange={onChange} meta={meta} />
      <BookFilterBar filters={filters} onChange={onChange} meta={meta} />
    </FilterRow>
  );
}
