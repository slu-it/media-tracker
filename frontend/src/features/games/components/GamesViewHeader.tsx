import type { ReactNode } from "react";
import { Box, Divider, Stack } from "@mui/material";
import { GameResultsBar } from "./GameResultsBar";
import { HALF_ROW_WIDTH, SECTION_GAP } from "./gamesLayout";

type ControlsLayout = "half" | "center";

interface GamesViewHeaderProps {
  /**
   * Row 2, optional (the overview has none, its filters sit in the results row): filters, sort toggle, year navigator etc. Centered and wraps onto multiple lines on narrow screens
   * for `"center"` (the default); an equal-column grid confined to the same centered, half-width column as
   * `search` for `"half"`. A component returning a
   * `React.Fragment` of several elements (e.g. `GameFilterBar`) works as `controls` for `"half"`: a
   * `Fragment` renders no DOM node of its own, so its children land directly in the grid as its items.
   */
  controls?: ReactNode;
  controlsLayout?: ControlsLayout;
  /** Row 1, optional: a search field wide enough to need its own centered row above `controls`. */
  search?: ReactNode;
  count: number | null;
  /** Right slot of the results row (the top `PaginationBar`), shared with `GameResultsBar`. */
  pagination?: ReactNode;
  /**
   * Optional slot right after the count in the results row (the overview's status toggles), outside the live
   * region. Keeps the row visible at a count of `0`; see `GameResultsBar`.
   */
  facts?: ReactNode;
}

/** Equal-column grid for the `"half"` layout; `"center"` stays a plain centered, wrapping flex row. */
const HALF_GRID_SX = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
  gap: SECTION_GAP,
  width: HALF_ROW_WIDTH,
} as const;

/**
 * Shared header for the games views: an optional search row, the controls row, the result count/pagination row
 * (`GameResultsBar`), and the divider separating the header from the grid below - one `SECTION_GAP` between
 * each row. The gap from the divider down to the grid comes from the grid's own top padding (`GRID_SX`'s `py`),
 * not from here, since a `Divider` is the header's last element: adding a `pb` here as well would double it.
 *
 * `GameResultsBar` is visually hidden rather than merely collapsed to no height once `count` is `0`, so it takes
 * no slot in this `Stack` and the gap between the row above it and the divider below stays exactly one
 * `SECTION_GAP`. Exception: with `facts` the row stays visible at `0`, so the toggles remain usable.
 */
export function GamesViewHeader({
  controls,
  controlsLayout = "center",
  search,
  count,
  pagination,
  facts,
}: GamesViewHeaderProps) {
  return (
    <Stack spacing={SECTION_GAP}>
      {search && (
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Box sx={{ width: HALF_ROW_WIDTH }}>{search}</Box>
        </Box>
      )}
      {controls == null ? null : controlsLayout === "center" ? (
        <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: SECTION_GAP }}>{controls}</Box>
      ) : (
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Box sx={HALF_GRID_SX}>{controls}</Box>
        </Box>
      )}
      <GameResultsBar count={count} facts={facts}>
        {pagination}
      </GameResultsBar>
      <Divider />
    </Stack>
  );
}
