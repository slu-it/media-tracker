import { LEGEND_GAP_SX } from "../fields/legendGap";
import type { IconComponent } from "./iconComponent";
import { StatusToggleBar } from "./StatusToggleBar";

interface StatusFilterBarProps<T extends string> {
  values: readonly T[];
  icons: Record<T, IconComponent>;
  getLabel: (value: T) => string;
  /** Visible legend above the bar and accessible name of the group. */
  groupLabel: string;
  value: readonly T[];
  onChange: (next: T[]) => void;
  /** Values that have something to show; the others are dimmed. `null` while still loading: nothing is dimmed then. */
  available: readonly T[] | null;
  /** Already translated hint of a dimmed value (e.g. "No games"). */
  dimmedHint: string;
}

/**
 * 32px high and roughly square: a small icon is 20px, plus 5px padding and the 1px border on each side. This
 * matches the count chip and the default `Pagination` page buttons next to it in the results row.
 */
const BUTTON_SX = { p: "5px", minWidth: 32, height: 32 } as const;

/**
 * One multi-select icon toggle group for the results row, with a visible legend above it. Nothing pressed means no
 * filter on that field. A value not in `available` is dimmed (with `dimmedHint`) but stays clickable.
 */
export function StatusFilterBar<T extends string>({
  values,
  icons,
  getLabel,
  groupLabel,
  value,
  onChange,
  available,
  dimmedHint,
}: StatusFilterBarProps<T>) {
  return (
    <StatusToggleBar<T>
      multiple
      values={values}
      icons={icons}
      getLabel={getLabel}
      groupLabel={groupLabel}
      value={value}
      onChange={onChange}
      dimmed={(v) => available !== null && !available.includes(v)}
      dimmedHint={dimmedHint}
      showLabel
      buttonSx={BUTTON_SX}
      legendSx={LEGEND_GAP_SX}
    />
  );
}
