import { Box } from "@mui/material";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useTranslation } from "react-i18next";
import type { Ownership, Progress } from "../domain/gameStatus";
import { StatusIcon } from "../../../components/media/status/StatusIcon";
import { OWNERSHIP_ICONS } from "./ownershipIcons";
import { PROGRESS_ICONS } from "./progressIcons";

/**
 * Small at-a-glance icons for a game's ownership, progress and hidden status; omits the hidden icon unless hidden.
 *
 * `variant="full"` (default) always shows the ownership icon, then progress. `variant="card"` is the compact list
 * form: a watchlist entry shows only the ownership icon, a subscription entry both, an owned one only the progress
 * icon. The hidden icon is unaffected.
 */
export function GameStatusIcons({
  ownership,
  progress,
  hidden,
  variant = "full",
}: {
  ownership: Ownership;
  progress: Progress;
  hidden: boolean;
  variant?: "card" | "full";
}) {
  const { t } = useTranslation();
  const showOwnership = variant === "full" || ownership !== "owned";
  const showProgress = variant === "full" || ownership !== "watchlist";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
      {showOwnership && <StatusIcon icon={OWNERSHIP_ICONS[ownership]} label={t(`games.ownership.${ownership}`)} />}
      {showProgress && <StatusIcon icon={PROGRESS_ICONS[progress]} label={t(`games.progress.${progress}`)} />}
      {hidden && <StatusIcon icon={VisibilityOffOutlinedIcon} label={t("games.fields.hidden")} />}
    </Box>
  );
}
