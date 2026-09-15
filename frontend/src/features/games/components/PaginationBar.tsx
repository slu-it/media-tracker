import { Pagination, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

interface PaginationBarProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/** Centered page controls with an "x–y of n" caption. Renders nothing for an empty list. */
export function PaginationBar({ page, pageSize, totalItems, totalPages, onPageChange, disabled }: PaginationBarProps) {
  const { t } = useTranslation();
  if (totalItems === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
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
        disabled={disabled}
      />
      <Typography variant="body2" color="text.secondary">
        {t("games.pagination.range", { from, to, total: totalItems })}
      </Typography>
    </Stack>
  );
}
