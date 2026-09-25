import { useRef } from "react";
import { Checkbox, IconButton, InputAdornment, ListItemText, MenuItem, TextField } from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import { useTranslation } from "react-i18next";
import type { GameMetaResponse, Ownership, Progress } from "../../../types/api";
import type { GameFilters } from "../domain/gameFilters";

interface GameFilterBarProps {
  filters: GameFilters;
  onChange: (filters: GameFilters) => void;
  /** `null` while the filter values are still loading. */
  meta: GameMetaResponse | null;
  disabled?: boolean;
}

interface FilterSelectProps<T extends string | number> {
  label: string;
  options: T[];
  selected: T[];
  onChange: (values: T[]) => void;
  getOptionLabel: (option: T) => string;
  disabled?: boolean;
  minWidth: number;
}

/** One multi-select shared by all four filters; shows `-all-` when nothing is selected. */
function FilterSelect<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  getOptionLabel,
  disabled,
  minWidth,
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
      sx={{ minWidth }}
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
          {/* Compact so an option row stays as high as a plain menu row and the theme's 6-row cap holds. */}
          <Checkbox checked={selected.includes(option)} size="small" sx={{ p: 0, mr: 1 }} />
          <ListItemText primary={getOptionLabel(option)} />
        </MenuItem>
      ))}
    </TextField>
  );
}

/** Platform, ownership, progress and release year multi-selects; several values in one field OR, all four AND. */
export function GameFilterBar({ filters, onChange, meta, disabled }: GameFilterBarProps) {
  const { t } = useTranslation();
  const platformLabel = (id: string) => meta?.platforms.find((platform) => platform.id === id)?.label ?? id;
  const ownershipLabel = (value: Ownership) => t(`games.ownership.${value}`);
  const progressLabel = (value: Progress) => t(`games.progress.${value}`);
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
        minWidth={200}
      />
      <FilterSelect
        label={t("games.filters.ownership")}
        options={meta?.ownership ?? []}
        selected={filters.ownership}
        onChange={(ownership) => onChange({ ...filters, ownership })}
        getOptionLabel={ownershipLabel}
        disabled={disabled || metaLoading}
        minWidth={160}
      />
      <FilterSelect
        label={t("games.filters.progress")}
        options={meta?.progress ?? []}
        selected={filters.progress}
        onChange={(progress) => onChange({ ...filters, progress })}
        getOptionLabel={progressLabel}
        disabled={disabled || metaLoading}
        minWidth={180}
      />
      <FilterSelect
        label={t("games.filters.releaseYear")}
        options={meta?.releaseYears ?? []}
        selected={filters.releaseYears}
        onChange={(releaseYears) => onChange({ ...filters, releaseYears })}
        getOptionLabel={yearLabel}
        disabled={disabled || metaLoading}
        minWidth={140}
      />
    </>
  );
}
