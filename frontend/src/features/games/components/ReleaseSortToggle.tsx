import { useId } from "react";
import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { WatchlistSort } from "../domain/gameViewParams";
import { FieldLegend } from "./fields/FieldLegend";
import { LEGEND_GAP_SX } from "./fields/legendGap";

interface ReleaseSortToggleProps {
  value: WatchlistSort;
  onChange: (value: WatchlistSort) => void;
  disabled?: boolean;
}

/**
 * Oldest-first/newest-first toggle for the watchlist's release-date sort, with a centred "Sort order" legend above
 * it that names the group. `exclusive` without a re-click handler would let MUI deselect both buttons on a second
 * click of the active one; ignoring `null` in `onChange` keeps exactly one selected, matching a normal radio group.
 * The buttons are 32px high, like the chip, the selects and the page buttons beside it.
 */
export function ReleaseSortToggle({ value, onChange, disabled }: ReleaseSortToggleProps) {
  const { t } = useTranslation();
  const legendId = useId();
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <FieldLegend id={legendId} sx={LEGEND_GAP_SX}>
        {t("games.sort.legend")}
      </FieldLegend>
      <ToggleButtonGroup
        exclusive
        size="small"
        color="primary"
        value={value}
        disabled={disabled}
        aria-labelledby={legendId}
        onChange={(_event, next: WatchlistSort | null) => {
          if (next !== null) onChange(next);
        }}
      >
        <ToggleButton value="release_asc" sx={BUTTON_SX}>
          {t("games.sort.releaseAsc")}
        </ToggleButton>
        <ToggleButton value="release_desc" sx={BUTTON_SX}>
          {t("games.sort.releaseDesc")}
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

/** Exactly 32px high (border box), the height the other controls of the results row share. */
const BUTTON_SX = { height: 32, py: 0, boxSizing: "border-box", whiteSpace: "nowrap" } as const;
