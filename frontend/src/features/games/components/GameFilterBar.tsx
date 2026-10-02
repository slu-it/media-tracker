import { useRef } from "react";
import { IconButton, InputAdornment, ListItemText, MenuItem, TextField } from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import { useTranslation } from "react-i18next";
import type { GameMetaResponse } from "../../../types/api";
import type { GameFilters } from "../domain/gameFilters";

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
}

/** One multi-select shared by the filters; shows `-all-` when nothing is selected. */
export function FilterSelect<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  getOptionLabel,
  disabled,
  fullWidth,
}: FilterSelectProps<T>) {
  const { t } = useTranslation();
  const isDisabled = disabled || options.length === 0;
  // The imperative handle MUI's Select exposes on `inputRef` (`{ focus, node, value }`), used to return focus to
  // the field once the clear button removes itself.
  const selectRef = useRef<{ focus: () => void } | null>(null);

  return (
    <TextField
      select
      // Matches GameSearchField, so the whole row above the grid is one height (small is 40px, medium 56px).
      size="small"
      label={label}
      value={selected}
      onChange={(event) => onChange(event.target.value as unknown as T[])}
      disabled={isDisabled}
      fullWidth={fullWidth}
      slotProps={{
        select: {
          multiple: true,
          displayEmpty: true,
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
}

/** Platform and release year multi-selects; several values in one field OR. (Ownership and progress are `StatusFilterToggles`.) */
export function GameFilterBar({ filters, onChange, meta, disabled }: GameFilterBarProps) {
  const { t } = useTranslation();
  const platformLabel = (id: string) => meta?.platforms.find((platform) => platform.id === id)?.label ?? id;
  const yearLabel = (value: number) => String(value);
  const metaLoading = meta === null;

  return (
    <>
      <FilterSelect
        label={t("games.filters.platform")}
        options={meta?.platforms.map((platform) => platform.id) ?? []}
        selected={filters.platformIds}
        onChange={(platformIds) => onChange({ ...filters, platformIds })}
        getOptionLabel={platformLabel}
        disabled={disabled || metaLoading}
        fullWidth
      />
      <FilterSelect
        label={t("games.filters.releaseYear")}
        options={meta?.releaseYears ?? []}
        selected={filters.releaseYears}
        onChange={(releaseYears) => onChange({ ...filters, releaseYears })}
        getOptionLabel={yearLabel}
        disabled={disabled || metaLoading}
        fullWidth
      />
    </>
  );
}
