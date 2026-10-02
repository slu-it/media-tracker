import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { WatchlistSort } from "../domain/gameViewParams";

interface ReleaseSortToggleProps {
  value: WatchlistSort;
  onChange: (value: WatchlistSort) => void;
  disabled?: boolean;
  /** Stretches to the width of the grid cell it sits in, splitting it evenly between the two buttons. */
  fullWidth?: boolean;
}

/**
 * Oldest-first/newest-first toggle for the watchlist's release-date sort. `exclusive` without a re-click handler
 * would let MUI deselect both buttons on a second click of the active one; ignoring `null` in `onChange` keeps
 * exactly one selected, matching a normal radio group.
 */
export function ReleaseSortToggle({ value, onChange, disabled, fullWidth }: ReleaseSortToggleProps) {
  const { t } = useTranslation();
  const releaseAsc = t("games.sort.releaseAsc");
  const releaseDesc = t("games.sort.releaseDesc");
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      fullWidth={fullWidth}
      value={value}
      disabled={disabled}
      aria-label={t("games.sort.label")}
      onChange={(_event, next: WatchlistSort | null) => {
        if (next !== null) onChange(next);
      }}
      // Matches GameFilterBar's small TextFields (40px), so the row above the grid is one height.
      sx={{ height: 40, minWidth: 0 }}
    >
      <ToggleButton value="release_asc" title={releaseAsc} sx={{ minWidth: 0 }}>
        <Box component="span" sx={ellipsisLabelSx}>
          {releaseAsc}
        </Box>
      </ToggleButton>
      <ToggleButton value="release_desc" title={releaseDesc} sx={{ minWidth: 0 }}>
        <Box component="span" sx={ellipsisLabelSx}>
          {releaseDesc}
        </Box>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

// MUI renders ToggleButton's content as inline-flex, which never truncates; a block-level span gets the
// ellipsis. minWidth: 0 lets the span shrink below its content's natural width inside the flex button.
const ellipsisLabelSx = {
  display: "block",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;
