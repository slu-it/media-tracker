import { useId, useRef } from "react";
import {
  Box,
  IconButton,
  InputAdornment,
  ListItemText,
  MenuItem,
  TextField,
  type SxProps,
  type Theme,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import { useTranslation } from "react-i18next";
import type { GameMetaResponse } from "../../../types/api";
import type { GameFilters } from "../domain/gameFilters";
import { FILTER_SELECT_SX } from "./filterLayout";
import { FieldLegend } from "./fields/FieldLegend";
import { LEGEND_GAP_SX } from "./fields/legendGap";

interface GameFilterBarProps {
  filters: GameFilters;
  onChange: (filters: GameFilters) => void;
  /** `null` while the filter values are still loading. */
  meta: GameMetaResponse | null;
  disabled?: boolean;
}

export interface FilterSelectProps<T extends string | number> {
  label: string;
  options: T[];
  selected: T[];
  onChange: (values: T[]) => void;
  getOptionLabel: (option: T) => string;
  disabled?: boolean;
  /** Stretches to the width of the grid cell it sits in (`GamesViewHeader`'s `"half"` layout). */
  fullWidth?: boolean;
  /** `"standard"` is underline only (the overview's results row); the default `"outlined"` is the watchlist's. */
  variant?: "outlined" | "standard";
  /** Fixed width in px; ignored with `fullWidth`. */
  width?: number;
  /** Extra styles for the field, merged after `width`; for responsive sizing. */
  sx?: SxProps<Theme>;
  /**
   * `"floating"` (default) is MUI's `InputLabel`. `"legend"` (with `variant="standard"`) shows the label as a
   * `FieldLegend` above a label-less select whose input area is 32px high, like the toggle bars beside it; `width`
   * and `sx` then apply to the legend + select block.
   */
  labelStyle?: "floating" | "legend";
}

/** Input area height in legend mode: the same 32px as the toggle bars, so bottom-aligned legends line up. */
const LEGEND_SELECT_HEIGHT = 32;

/** One multi-select shared by the filters; shows `-all-` when nothing is selected. */
export function FilterSelect<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  getOptionLabel,
  disabled,
  fullWidth,
  variant = "outlined",
  width,
  sx,
  labelStyle = "floating",
}: FilterSelectProps<T>) {
  const legendId = useId();
  const legendMode = labelStyle === "legend";
  const { t } = useTranslation();
  const isDisabled = disabled || options.length === 0;
  // The imperative handle MUI's Select exposes on `inputRef` (`{ focus, node, value }`), used to return focus to
  // the field once the clear button removes itself.
  const selectRef = useRef<{ focus: () => void } | null>(null);

  const field = (
    <TextField
      select
      variant={variant}
      // Matches GameSearchField, so the whole row above the grid is one height (small is 40px, medium 56px).
      size="small"
      label={legendMode ? undefined : label}
      value={selected}
      onChange={(event) => onChange(event.target.value as unknown as T[])}
      disabled={isDisabled}
      fullWidth={fullWidth || legendMode}
      sx={
        legendMode
          ? { "& .MuiInput-root": { minHeight: LEGEND_SELECT_HEIGHT, mt: 0, alignItems: "center" } }
          : [!fullWidth && width !== undefined && { width }, ...(Array.isArray(sx) ? sx : [sx])]
      }
      slotProps={{
        select: {
          multiple: true,
          displayEmpty: true,
          ...(legendMode && { labelId: legendId }), // an explicit undefined would drop the TextField's own labelId
          renderValue: (value) => {
            const selectedValues = value as T[];
            return selectedValues.length === 0 ? t("games.filters.all") : selectedValues.map(getOptionLabel).join(", ");
          },
        },
        inputLabel: { shrink: true }, // displayEmpty + label would otherwise overlap
        input: {
          inputRef: selectRef,
          endAdornment: selected.length > 0 && !isDisabled && (
            <InputAdornment position="end">
              {/* MUI's select positions this adornment itself and only reserves room for a 24px icon. */}
              <IconButton
                size="small"
                aria-label={t("games.filters.clear", { label })}
                onClick={() => {
                  onChange([]);
                  selectRef.current?.focus();
                }}
                sx={{ p: "2px" }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    >
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          <ListItemText primary={getOptionLabel(option)} />
        </MenuItem>
      ))}
    </TextField>
  );
  if (!legendMode) return field;
  return (
    <Box sx={[!fullWidth && width !== undefined && { width }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <FieldLegend id={legendId} sx={[LEGEND_GAP_SX, { display: "block", textAlign: "left" }]}>
        {label}
      </FieldLegend>
      {field}
    </Box>
  );
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
        label={t("games.filters.releaseYear")}
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
