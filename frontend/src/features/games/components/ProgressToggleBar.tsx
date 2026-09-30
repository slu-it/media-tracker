import { useId } from "react";
import { Box, ToggleButton, ToggleButtonGroup, Tooltip, type SxProps, type Theme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { PROGRESS_VALUES, type Progress } from "../domain/gameStatus";
import { FieldLegend } from "./fields/FieldLegend";
import { PROGRESS_ICONS } from "./progressIcons";

interface ProgressToggleBarProps {
  value: Progress;
  onChange: (next: Progress) => void;
  /** Blocks changes while a save is in flight. */
  disabled?: boolean;
  /** Id of a visible label element; when given it names the group instead of the built-in "Progress" label. */
  "aria-labelledby"?: string;
  /** Shows a visible "Progress" legend above the bar and names the group by it (wins over `aria-labelledby`). */
  showLabel?: boolean;
  /** Placement only (margins, alignment); with `showLabel` it applies to the legend + bar block. */
  sx?: SxProps<Theme>;
}

/**
 * Row of small exclusive icon toggles, one per progress value in `PROGRESS_VALUES` order; the label is tooltip and
 * accessible name only. `null` (a click on the pressed button) is ignored so exactly one stays selected.
 *
 * `disabled` does not set `disabled` on the buttons: MUI logs a console.error for a Tooltip around a disabled
 * button. Clicks are blocked in the handler instead and the group is marked `aria-busy` and dimmed. MUI 9 passes
 * the first/last position class per child through context, so the Tooltip wrappers keep the joined borders.
 */
export function ProgressToggleBar({
  value,
  onChange,
  disabled,
  sx,
  showLabel,
  "aria-labelledby": labelledBy,
}: ProgressToggleBarProps) {
  const { t } = useTranslation();
  const legendId = useId();
  const nameBy = showLabel ? legendId : labelledBy;
  const group = (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      aria-label={nameBy ? undefined : t("games.fields.progress")}
      aria-labelledby={nameBy}
      aria-busy={disabled || undefined}
      onChange={(_event, next: Progress | null) => {
        if (next !== null && !disabled) onChange(next);
      }}
      sx={[disabled && { opacity: 0.6, pointerEvents: "none" }, ...(showLabel ? [] : Array.isArray(sx) ? sx : [sx])]}
    >
      {PROGRESS_VALUES.map((progress) => {
        const Icon = PROGRESS_ICONS[progress];
        const label = t(`games.progress.${progress}`);
        return (
          <Tooltip key={progress} title={label}>
            <ToggleButton value={progress} aria-label={label} aria-disabled={disabled || undefined}>
              <Icon fontSize="small" />
            </ToggleButton>
          </Tooltip>
        );
      })}
    </ToggleButtonGroup>
  );
  if (!showLabel) return group;
  return (
    <Box
      sx={[
        { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <FieldLegend id={legendId}>{t("games.fields.progress")}</FieldLegend>
      {group}
    </Box>
  );
}
