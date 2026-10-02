import type { ReactNode } from "react";
import { Box, Chip, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { SECTION_GAP } from "./gamesLayout";

interface GameResultsBarProps {
  count: number | null;
  /** Right slot, pinned to the right edge (the top pagination bar). Dropped at `count === 0`. */
  children?: ReactNode;
  /**
   * Optional slot right after the count (the overview's status filter toggles). Rendered outside the
   * `role="status"` wrapper, so using it is not announced as part of the count. Stays visible at `count === 0`.
   */
  facts?: ReactNode;
}

const VISUALLY_HIDDEN_SX = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

/**
 * Result count (a neutral outlined `Chip` inside an always-mounted `role="status"` wrapper, so the live region
 * does not mount and unmount with the chip) on the left, an optional right slot (the top pagination bar) pinned to the right edge via
 * `ml: "auto"` so it stays right-aligned even when it wraps onto its own line under the count on narrow
 * screens. A fixed `minHeight` (the dense `Pagination`'s own 32px height) keeps the grid below from jumping
 * while `count` is still loading (`null`), so the visible gaps above and below this row equal `SECTION_GAP`.
 * A `count` of `0` keeps the `role="status"` region mounted with the "0 games" announcement for assistive tech,
 * but drops the right slot, since the empty state elsewhere already covers that case; the row itself is then
 * visually hidden (absolutely positioned, clipped to nothing) instead of merely collapsed to no height, so it
 * takes no flex slot in the header `Stack` above it and the surrounding `SECTION_GAP`s don't leave an extra gap.
 * Unmounting the region entirely would drop it as a target for assistive tech and for tests waiting on it while
 * a request is still in flight.
 *
 * With `facts` the left part is the chip followed by the slot in a wrapping flex row with a small gap, and the
 * row stays visible at `count === 0` (chip "0 games" plus the slot, pagination dropped), so a filter combination
 * without results can still be undone. Without `facts` the behaviour above is unchanged.
 *
 * The status region always sits at the same depth (one left wrapper holding it and `facts`), so switching `facts`
 * on or off never remounts the live region.
 *
 * Without `children` (the ranking view, which has no pagination to balance) the count centers instead of sitting
 * at the left edge of an otherwise-empty row.
 */
export function GameResultsBar({ count, children, facts }: GameResultsBarProps) {
  const { t } = useTranslation();
  const isEmpty = count === 0;
  const hasChildren = children != null;
  const hasFacts = facts != null;
  const hidden = isEmpty && !hasFacts;

  return (
    <Stack
      direction="row"
      sx={
        hidden
          ? VISUALLY_HIDDEN_SX
          : {
              justifyContent: hasChildren ? "space-between" : "center",
              // With facts the chip, toggle bars, select underlines and page buttons share one bottom line.
              alignItems: hasFacts ? "flex-end" : "center",
              flexWrap: "wrap",
              rowGap: SECTION_GAP,
              minHeight: 32,
            }
      }
    >
      <Box
        sx={{
          display: "flex",
          alignItems: hasFacts ? "flex-end" : "center",
          flexWrap: "wrap",
          gap: hasFacts ? 3 : 1.5,
        }}
      >
        <Box role="status" sx={{ display: "flex", alignItems: "center" }}>
          {count !== null && <Chip variant="outlined" label={t("games.resultCount", { count })} />}
        </Box>
        {facts}
      </Box>
      {!isEmpty && hasChildren && <Box sx={{ ml: "auto" }}>{children}</Box>}
    </Stack>
  );
}
