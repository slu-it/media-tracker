import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { FILTER_SELECT_SX } from "../../../components/media/filters/filterLayout";
import { FilterSelect } from "../../../components/media/filters/FilterSelect";
import type { BookMetaResponse } from "../../../types/api";
import type { BookFilters } from "../domain/bookFilters";

interface BookFilterBarProps {
  filters: BookFilters;
  onChange: (filters: BookFilters) => void;
  /** `null` while the filter values are still loading. */
  meta: BookMetaResponse | null;
  disabled?: boolean;
}

/** Type and release year standard (underline) multi-selects of the overview's results row; several values in one field OR. (Ownership and progress are `BookStatusFilterToggles`.) */
export function BookFilterBar({ filters, onChange, meta, disabled }: BookFilterBarProps) {
  const { t } = useTranslation();
  const typeLabel = (id: string) => meta?.types.find((type) => type.id === id)?.label ?? id;
  const yearLabel = (value: number) => String(value);
  const metaLoading = meta === null;

  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: { xs: 1.5, sm: 3 }, width: { xs: "100%", sm: "auto" } }}>
      <FilterSelect
        label={t("books.filters.type")}
        options={meta?.types.map((type) => type.id) ?? []}
        selected={filters.typeIds}
        onChange={(typeIds) => onChange({ ...filters, typeIds })}
        getOptionLabel={typeLabel}
        disabled={disabled || metaLoading}
        variant="standard"
        labelStyle="legend"
        sx={FILTER_SELECT_SX}
      />
      <FilterSelect
        label={t("media.filters.releaseYear")}
        options={meta?.releaseYears ?? []}
        selected={filters.releaseYears}
        onChange={(releaseYears) => onChange({ ...filters, releaseYears })}
        getOptionLabel={yearLabel}
        disabled={disabled || metaLoading}
        variant="standard"
        labelStyle="legend"
        sx={FILTER_SELECT_SX}
      />
    </Box>
  );
}
