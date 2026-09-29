import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { SECTION_GAP } from "./gamesLayout";

interface GameResultsBarProps {
  count: number | null;
  children?: ReactNode;
}

/**
 * Result count on the left, an optional right slot (the top pagination bar) pinned to the right edge via
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
 * Without `children` (the ranking view, which has no pagination to balance) the count centers instead of sitting
 * at the left edge of an otherwise-empty row.
 */
export function GameResultsBar({ count, children }: GameResultsBarProps) {
  const { t } = useTranslation();
  const isEmpty = count === 0;
  const hasChildren = children != null;

  return (
    <Stack
      direction="row"
      sx={
        isEmpty
          ? {
              position: "absolute",
              width: "1px",
              height: "1px",
              margin: "-1px",
              padding: 0,
              overflow: "hidden",
              clipPath: "inset(50%)",
              whiteSpace: "nowrap",
              border: 0,
            }
          : {
              justifyContent: hasChildren ? "space-between" : "center",
              alignItems: "center",
              flexWrap: "wrap",
              rowGap: SECTION_GAP,
              minHeight: 32,
            }
      }
    >
      <Typography variant="body2" color="text.secondary" role="status">
        {count !== null && t("games.resultCount", { count })}
      </Typography>
      {!isEmpty && hasChildren && <Box sx={{ ml: "auto" }}>{children}</Box>}
    </Stack>
  );
}
