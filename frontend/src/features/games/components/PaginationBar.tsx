import { Pagination, Stack } from "@mui/material";

interface PaginationBarProps {
  page: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/** Centered page controls, no caption. Renders nothing for an empty list. */
export function PaginationBar({ page, totalItems, totalPages, onPageChange, disabled }: PaginationBarProps) {
  if (totalItems === 0) return null;
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "center", py: 1.5 }}>
      <Pagination
        count={totalPages}
        page={page}
        onChange={(_event, next) => onPageChange(next)}
        color="primary"
        shape="rounded"
        showFirstButton
        showLastButton
        // Caps the numbered buttons at 5 (boundaryCount*2 + siblingCount*2 + 3) next to the four arrows,
        // now that the search field and four filter selects share the row above.
        boundaryCount={0}
        siblingCount={1}
        disabled={disabled}
      />
    </Stack>
  );
}
