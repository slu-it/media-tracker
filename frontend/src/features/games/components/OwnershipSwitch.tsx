import { useId } from "react";
import { Box, Switch, Tooltip, type SxProps, type Theme } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { Ownership } from "../domain/gameStatus";
import { FieldLegend } from "./fields/FieldLegend";
import { OWNERSHIP_ICONS } from "./ownershipIcons";

interface OwnershipSwitchProps {
  value: Ownership;
  onChange: (next: Ownership) => void;
  /** Blocks changes while a save is in flight. */
  disabled?: boolean;
  /** Id of a visible label element; when given it names the group instead of the built-in "Ownership" label. */
  "aria-labelledby"?: string;
  /** Shows a visible "Ownership" legend above the switch and names the group by it (wins over `aria-labelledby`). */
  showLabel?: boolean;
  /** Passed to the MUI Switch; `"start"` aligns the switch flush-left with a label above it. */
  edge?: "start" | "end" | false;
  /** Placement only (margins, alignment); applies to the whole block. */
  sx?: SxProps<Theme>;
}

const THUMB_SIZE = 20;

function Thumb({ ownership, checked }: { ownership: Ownership; checked: boolean }) {
  const Icon = OWNERSHIP_ICONS[ownership];
  return (
    <Box
      sx={(theme) => ({
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        boxShadow: theme.shadows[1],
        // The theme runs with cssVariables, so `vars` is always set; `Switch.defaultColor` exists only there.
        backgroundColor: checked ? "primary.main" : theme.vars?.palette.Switch.defaultColor,
        color: checked ? "primary.contrastText" : "text.secondary",
      })}
    >
      <Icon sx={{ fontSize: 14 }} />
    </Box>
  );
}

/**
 * Two-state switch watchlist/owned whose thumb carries the current state's icon; the label is tooltip and accessible
 * name only (unless `showLabel`).
 *
 * `disabled` does not set `disabled` on the input: MUI logs a console.error for a Tooltip around a disabled
 * element. Changes are blocked in the handler instead (also Space) and the block is marked `aria-busy` and dimmed.
 */
export function OwnershipSwitch({
  value,
  onChange,
  disabled,
  edge,
  sx,
  showLabel,
  "aria-labelledby": labelledBy,
}: OwnershipSwitchProps) {
  const { t } = useTranslation();
  const legendId = useId();
  const nameBy = showLabel ? legendId : labelledBy;
  return (
    <Box
      role="group"
      aria-label={nameBy ? undefined : t("games.fields.ownership")}
      aria-labelledby={nameBy}
      aria-busy={disabled || undefined}
      sx={[
        { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
        disabled && { opacity: 0.6, pointerEvents: "none" },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {showLabel && <FieldLegend id={legendId}>{t("games.fields.ownership")}</FieldLegend>}
      <Tooltip describeChild title={t(`games.ownership.${value}`)}>
        <Box component="span" sx={{ display: "inline-flex" }}>
          <Switch
            edge={edge}
            checked={value === "owned"}
            onChange={(_event, checked) => {
              if (!disabled) onChange(checked ? "owned" : "watchlist");
            }}
            icon={<Thumb ownership="watchlist" checked={false} />}
            checkedIcon={<Thumb ownership="owned" checked />}
            slotProps={{
              input: { "aria-label": t("games.ownership.owned"), "aria-disabled": disabled || undefined },
            }}
          />
        </Box>
      </Tooltip>
    </Box>
  );
}
