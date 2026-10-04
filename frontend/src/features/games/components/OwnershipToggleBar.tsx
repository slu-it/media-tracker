import type { SxProps, Theme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { OWNERSHIP_VALUES, type Ownership } from "../domain/gameStatus";
import { OWNERSHIP_ICONS } from "./ownershipIcons";
import { StatusToggleBar } from "./StatusToggleBar";

interface OwnershipToggleBarProps {
  value: Ownership;
  onChange: (next: Ownership) => void;
  /** Blocks changes while a save is in flight. */
  disabled?: boolean;
  /** Id of a visible label element; when given it names the group instead of the built-in "Ownership" label. */
  "aria-labelledby"?: string;
  /** Shows a visible "Ownership" legend above the bar and names the group by it (wins over `aria-labelledby`). */
  showLabel?: boolean;
  /** Placement only (margins, alignment); with `showLabel` it applies to the legend + bar block. */
  sx?: SxProps<Theme>;
}

/** Exclusive `StatusToggleBar` over `OWNERSHIP_VALUES`; exactly one ownership value is always selected. */
export function OwnershipToggleBar({
  value,
  onChange,
  disabled,
  sx,
  showLabel,
  "aria-labelledby": labelledBy,
}: OwnershipToggleBarProps) {
  const { t } = useTranslation();
  return (
    <StatusToggleBar
      values={OWNERSHIP_VALUES}
      icons={OWNERSHIP_ICONS}
      getLabel={(ownership) => t(`games.ownership.${ownership}`)}
      groupLabel={t("games.fields.ownership")}
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-labelledby={labelledBy}
      showLabel={showLabel}
      sx={sx}
    />
  );
}
