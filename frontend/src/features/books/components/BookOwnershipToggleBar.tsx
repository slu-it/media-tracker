import type { SxProps, Theme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { BOOK_OWNERSHIP_VALUES, type BookOwnership } from "../domain/bookStatus";
import { BOOK_OWNERSHIP_ICONS } from "./bookOwnershipIcons";
import { StatusToggleBar } from "../../../components/media/status/StatusToggleBar";

interface BookOwnershipToggleBarProps {
  value: BookOwnership;
  onChange: (next: BookOwnership) => void;
  /** Blocks changes while a save is in flight. */
  disabled?: boolean;
  /** Id of a visible label element; when given it names the group instead of the built-in "Ownership" label. */
  "aria-labelledby"?: string;
  /** Shows a visible "Ownership" legend above the bar and names the group by it (wins over `aria-labelledby`). */
  showLabel?: boolean;
  /** Placement only (margins, alignment); with `showLabel` it applies to the legend + bar block. */
  sx?: SxProps<Theme>;
}

/** Exclusive `StatusToggleBar` over `BOOK_OWNERSHIP_VALUES`; exactly one ownership value is always selected. */
export function BookOwnershipToggleBar({
  value,
  onChange,
  disabled,
  sx,
  showLabel,
  "aria-labelledby": labelledBy,
}: BookOwnershipToggleBarProps) {
  const { t } = useTranslation();
  return (
    <StatusToggleBar
      values={BOOK_OWNERSHIP_VALUES}
      icons={BOOK_OWNERSHIP_ICONS}
      getLabel={(ownership) => t(`books.ownership.${ownership}`)}
      groupLabel={t("media.fields.ownership")}
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-labelledby={labelledBy}
      showLabel={showLabel}
      sx={sx}
    />
  );
}
