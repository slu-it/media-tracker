import { Pagination, Stack } from "@mui/material";
import { SECTION_GAP } from "./gamesLayout";

interface PaginationBarProps {
  page: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  /** Drops the vertical padding, for the top bar sharing a row with the results count. */
  dense?: boolean;
}

/**
 * Right-aligned page controls, no caption. Renders nothing for an empty list. Scrolls the window to the top when the
 * user clicks another page; prop changes (corrections, refinements, Back/Forward) never scroll.
 */
export function PaginationBar({ page, totalItems, totalPages, onPageChange, disabled, dense }: PaginationBarProps) {
  if (totalItems === 0) return null;
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{
        alignItems: "center",
        justifyContent: "flex-end",
        pt: dense ? 0 : SECTION_GAP,
        pb: 0,
      }}
    >
      <Pagination
        count={totalPages}
        page={page}
        onChange={(_event, next) => {
          if (next === page) return;
          onPageChange(next);
          window.scrollTo({ top: 0 });
        }}
        color="primary"
        shape="rounded"
        showFirstButton
        showLastButton
        // Caps the numbered buttons at 5 (boundaryCount*2 + siblingCount*2 + 3) next to the four arrows: the top
        // bar shares its row with the result count beside it, and both need to fit on narrow screens.
        boundaryCount={0}
        siblingCount={1}
        disabled={disabled}
      />
    </Stack>
  );
}
