import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { FILTER_SELECT_SX } from "../../../components/media/filters/filterLayout";
import { FilterSelect } from "../../../components/media/filters/FilterSelect";
import type { GameMetaResponse } from "../../../types/api";
import type { GameFilters } from "../domain/gameFilters";

interface GameFilterBarProps {
  filters: GameFilters;
  onChange: (filters: GameFilters) => void;
  /** `null` while the filter values are still loading. */
  meta: GameMetaResponse | null;
  disabled?: boolean;
}

/** Platform and release year standard (underline) multi-selects of the overview's results row; several values in one field OR. (Ownership and progress are `StatusFilterToggles`.) */
export function GameFilterBar({ filters, onChange, meta, disabled }: GameFilterBarProps) {
  const { t } = useTranslation();
  const platformLabel = (id: string) => meta?.platforms.find((platform) => platform.id === id)?.label ?? id;
  const yearLabel = (value: number) => String(value);
  const metaLoading = meta === null;

  return (
    // Full row width on phones (the two selects share one line), inline at 200px each from `sm`.
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: { xs: 1.5, sm: 3 }, width: { xs: "100%", sm: "auto" } }}>
      <FilterSelect
        label={t("games.filters.platform")}
        options={meta?.platforms.map((platform) => platform.id) ?? []}
        selected={filters.platformIds}
        onChange={(platformIds) => onChange({ ...filters, platformIds })}
        getOptionLabel={platformLabel}
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
