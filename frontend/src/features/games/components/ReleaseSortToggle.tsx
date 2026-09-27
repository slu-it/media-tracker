import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GameSort } from "../../../types/api";

interface ReleaseSortToggleProps {
  value: GameSort;
  onChange: (value: GameSort) => void;
  disabled?: boolean;
}

/**
 * Oldest-first/newest-first toggle for the watchlist's release-date sort. `exclusive` without a re-click handler
 * would let MUI deselect both buttons on a second click of the active one; ignoring `null` in `onChange` keeps
 * exactly one selected, matching a normal radio group.
 */
export function ReleaseSortToggle({ value, onChange, disabled }: ReleaseSortToggleProps) {
  const { t } = useTranslation();
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      disabled={disabled}
      aria-label={t("games.sort.label")}
      onChange={(_event, next: GameSort | null) => {
        if (next !== null) onChange(next);
      }}
      // Matches GameFilterBar's small TextFields (40px), so the row above the grid is one height.
      sx={{ height: 40 }}
    >
      <ToggleButton value="release_asc">{t("games.sort.releaseAsc")}</ToggleButton>
      <ToggleButton value="release_desc">{t("games.sort.releaseDesc")}</ToggleButton>
    </ToggleButtonGroup>
  );
}
