import { Box, Tooltip } from "@mui/material";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useTranslation } from "react-i18next";
import type { Ownership, Progress } from "../domain/gameStatus";
import { OWNERSHIP_ICONS } from "./ownershipIcons";
import { PROGRESS_ICONS } from "./progressIcons";

/**
 * Small at-a-glance icons for a game's ownership, progress and hidden status; omits the hidden icon unless hidden.
 *
 * `variant="full"` (default) always shows the ownership icon, then progress. `variant="card"` is the compact list
 * form: a watchlist entry shows only the ownership icon, an owned one only the progress icon. The hidden icon is
 * unaffected.
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
  const OwnershipIcon = OWNERSHIP_ICONS[ownership];
  const showOwnership = variant === "full" || ownership === "watchlist";
  const showProgress = variant === "full" || ownership === "owned";
  const ProgressIcon = PROGRESS_ICONS[progress];

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
      {showOwnership && (
        <Tooltip title={t(`games.ownership.${ownership}`)}>
          <OwnershipIcon
            fontSize="small"
            titleAccess={t(`games.ownership.${ownership}`)}
            sx={{ color: "text.secondary" }}
          />
        </Tooltip>
      )}
      {showProgress && (
        <Tooltip title={t(`games.progress.${progress}`)}>
          <ProgressIcon
            fontSize="small"
            titleAccess={t(`games.progress.${progress}`)}
            sx={{ color: "text.secondary" }}
          />
        </Tooltip>
      )}
      {hidden && (
        <Tooltip title={t("games.fields.hidden")}>
          <VisibilityOffOutlinedIcon
            fontSize="small"
            titleAccess={t("games.fields.hidden")}
            sx={{ color: "text.secondary" }}
          />
        </Tooltip>
      )}
    </Box>
  );
}
