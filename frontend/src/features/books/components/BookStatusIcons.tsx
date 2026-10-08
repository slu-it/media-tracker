import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { BookOwnership, BookProgress } from "../domain/bookStatus";
import { StatusIcon } from "../../../components/media/status/StatusIcon";
import { BOOK_OWNERSHIP_ICONS } from "./bookOwnershipIcons";
import { BOOK_PROGRESS_ICONS } from "./bookProgressIcons";

/**
 * Small at-a-glance icons for a book's ownership and progress.
 *
 * `variant="full"` (default) shows the ownership icon, then progress. `variant="card"` is the compact list form: a
 * watchlist book shows only the ownership icon, an owned one only the progress icon.
 */
export function BookStatusIcons({
  ownership,
  progress,
  variant = "full",
}: {
  ownership: BookOwnership;
  progress: BookProgress;
  variant?: "card" | "full";
}) {
  const { t } = useTranslation();
  const showOwnership = variant === "full" || ownership !== "owned";
  const showProgress = variant === "full" || ownership !== "watchlist";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
      {showOwnership && <StatusIcon icon={BOOK_OWNERSHIP_ICONS[ownership]} label={t(`books.ownership.${ownership}`)} />}
      {showProgress && <StatusIcon icon={BOOK_PROGRESS_ICONS[progress]} label={t(`books.progress.${progress}`)} />}
    </Box>
  );
}
