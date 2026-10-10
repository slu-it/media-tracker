import { useId } from "react";
import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GroupSort } from "../../../domain/media/groupViewParams";
import { FieldLegend } from "../fields/FieldLegend";
import { LEGEND_GAP_SX } from "../fields/legendGap";

interface GroupSortToggleProps {
  value: GroupSort;
  onChange: (value: GroupSort) => void;
  /** The kind's text for the volume option, e.g. "Most books". */
  volumeLabel: string;
}

/**
 * Name/volume toggle of the group views, built like `ReleaseSortToggle`: ignoring `null` in `onChange` keeps
 * exactly one button selected.
 */
export function GroupSortToggle({ value, onChange, volumeLabel }: GroupSortToggleProps) {
  const { t } = useTranslation();
  const legendId = useId();
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <FieldLegend id={legendId} sx={LEGEND_GAP_SX}>
        {t("media.sort.legend")}
      </FieldLegend>
      <ToggleButtonGroup
        exclusive
        size="small"
        color="primary"
        value={value}
        aria-labelledby={legendId}
        onChange={(_event, next: GroupSort | null) => {
          if (next !== null) onChange(next);
        }}
      >
        <ToggleButton value="name" sx={BUTTON_SX}>
          {t("media.sort.name")}
        </ToggleButton>
        <ToggleButton value="volume" sx={BUTTON_SX}>
          {volumeLabel}
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

/** Exactly 32px high (border box), like the other controls of the results row. */
const BUTTON_SX = { height: 32, py: 0, boxSizing: "border-box", whiteSpace: "nowrap" } as const;
