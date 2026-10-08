import { useId } from "react";
import { Box, ToggleButton, ToggleButtonGroup, Tooltip, type SxProps, type Theme } from "@mui/material";
import { FieldLegend } from "../fields/FieldLegend";
import type { IconComponent } from "./iconComponent";

interface StatusToggleBarBaseProps<T extends string> {
  /**
   * The options in display order. Also the order in which `multiple` mode reports its selection, so direct callers
   * must list them in the order they want back (the URL codec sorts its own values anyway).
   */
  values: readonly T[];
  icons: Record<T, IconComponent>;
  /** Tooltip and accessible name of a button. */
  getLabel: (value: T) => string;
  /** Accessible name of the group and text of the legend shown by `showLabel`. */
  groupLabel: string;
  /** Blocks changes while a save is in flight. */
  disabled?: boolean;
  /** Id of a visible label element; when given it names the group instead of `groupLabel`. */
  "aria-labelledby"?: string;
  /** Shows a visible legend (`groupLabel`) above the bar and names the group by it (wins over `aria-labelledby`). */
  showLabel?: boolean;
  /** Placement only (margins, alignment); with `showLabel` it applies to the legend + bar block. */
  sx?: SxProps<Theme>;
  /** Marks buttons as dimmed (see the component KDoc). They stay clickable and keep their plain label. */
  dimmed?: (value: T) => boolean;
  /** Text appended to the tooltip and used as `aria-description` of a dimmed button; give it together with `dimmed`. */
  dimmedHint?: string;
  /** Extra styles for every button, e.g. a fixed height for a denser variant. The default size is unchanged. */
  buttonSx?: SxProps<Theme>;
  /** Extra styles for the `showLabel` legend only (ignored without it), e.g. a visual offset to line it up with neighbouring labels. */
  legendSx?: SxProps<Theme>;
}

interface StatusToggleBarSingleProps<T extends string> extends StatusToggleBarBaseProps<T> {
  multiple?: false;
  value: T;
  onChange: (next: T) => void;
}

interface StatusToggleBarMultipleProps<T extends string> extends StatusToggleBarBaseProps<T> {
  multiple: true;
  value: readonly T[];
  /** Always the full selection in `values` order, never click order; `[]` when nothing is pressed. */
  onChange: (next: T[]) => void;
}

export type StatusToggleBarProps<T extends string> = StatusToggleBarSingleProps<T> | StatusToggleBarMultipleProps<T>;

/**
 * Row of small icon toggles, one per entry of `values` in that order; the label is tooltip and accessible name only.
 *
 * Single mode (default): exclusive, exactly one value is pressed. `null` (a click on the pressed button) is ignored
 * so one stays selected. `multiple` mode: any number may be pressed, including none; `onChange` receives the whole
 * selection ordered like `values`.
 *
 * `dimmed(value)` marks a value that has nothing to show: the button gets `aria-description` and a tooltip suffix
 * (`dimmedHint`), its accessible name stays the plain label, and it stays clickable and focusable. It is also drawn
 * at lower opacity with `data-dimmed="true"` (the marker tests assert) unless it is pressed: a pressed button is
 * never dimmed visually, so pressed always reads as pressed, but it keeps the description.
 *
 * `color="primary"` on the group makes a pressed button's icon (currentColor) use the theme's primary colour, like
 * the selected `Pagination` page.
 *
 * `disabled` does not set `disabled` on the buttons: MUI logs a console.error for a Tooltip around a disabled
 * button. Clicks are blocked in the handler instead, the group is marked `aria-busy` and dimmed and the buttons get
 * `aria-disabled`. MUI 9 passes the first/last position class per child through context, so the Tooltip wrappers
 * keep the joined borders.
 */
export function StatusToggleBar<T extends string>(props: StatusToggleBarProps<T>) {
  const { values, icons, getLabel, groupLabel, disabled, sx, showLabel, dimmed, dimmedHint, buttonSx, legendSx } =
    props;
  const legendId = useId();
  const nameBy = showLabel ? legendId : props["aria-labelledby"];
  const buttons = values.map((value) => {
    const Icon: IconComponent = icons[value];
    const label = getLabel(value);
    const isDimmed = dimmed?.(value) ?? false;
    const isPressed = props.multiple ? props.value.includes(value) : props.value === value;
    const fadedOut = isDimmed && !isPressed;
    return (
      <Tooltip key={value} title={isDimmed && dimmedHint ? `${label} · ${dimmedHint}` : label}>
        <ToggleButton
          value={value}
          aria-label={label}
          aria-description={isDimmed ? dimmedHint : undefined}
          aria-disabled={disabled || undefined}
          data-dimmed={fadedOut || undefined}
          sx={[fadedOut && { opacity: 0.5 }, ...(Array.isArray(buttonSx) ? buttonSx : [buttonSx])]}
        >
          <Icon fontSize="small" />
        </ToggleButton>
      </Tooltip>
    );
  });
  const groupSx = [
    disabled && { opacity: 0.6, pointerEvents: "none" },
    ...(showLabel ? [] : Array.isArray(sx) ? sx : [sx]),
  ];
  const common = {
    size: "small",
    color: "primary",
    "aria-label": nameBy ? undefined : groupLabel,
    "aria-labelledby": nameBy,
    "aria-busy": disabled || undefined,
    sx: groupSx,
  } as const;
  const group = props.multiple ? (
    <ToggleButtonGroup
      {...common}
      value={props.value}
      onChange={(_event, next: T[]) => {
        if (!disabled) props.onChange(values.filter((v) => next.includes(v)));
      }}
    >
      {buttons}
    </ToggleButtonGroup>
  ) : (
    <ToggleButtonGroup
      {...common}
      exclusive
      value={props.value}
      onChange={(_event, next: T | null) => {
        if (next !== null && !disabled) props.onChange(next);
      }}
    >
      {buttons}
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
      <FieldLegend id={legendId} sx={legendSx}>
        {groupLabel}
      </FieldLegend>
      {group}
    </Box>
  );
}
