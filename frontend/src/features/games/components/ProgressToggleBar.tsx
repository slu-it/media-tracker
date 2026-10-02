import type { SxProps, Theme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { PROGRESS_VALUES, type Progress } from "../domain/gameStatus";
import { PROGRESS_ICONS } from "./progressIcons";
import { StatusToggleBar } from "./StatusToggleBar";

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

/** Exclusive `StatusToggleBar` over `PROGRESS_VALUES`; exactly one progress value is always selected. */
export function ProgressToggleBar({
  value,
  onChange,
  disabled,
  sx,
  showLabel,
  "aria-labelledby": labelledBy,
}: ProgressToggleBarProps) {
  const { t } = useTranslation();
  return (
    <StatusToggleBar
      values={PROGRESS_VALUES}
      icons={PROGRESS_ICONS}
      getLabel={(progress) => t(`games.progress.${progress}`)}
      groupLabel={t("games.fields.progress")}
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-labelledby={labelledBy}
      showLabel={showLabel}
      sx={sx}
    />
  );
}
