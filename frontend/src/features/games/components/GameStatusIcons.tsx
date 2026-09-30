import { Box, Tooltip } from "@mui/material";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useTranslation } from "react-i18next";
import type { Ownership, Progress } from "../domain/gameStatus";
import { PROGRESS_ICONS, type IconComponent } from "./progressIcons";

// Only `watchlist` gets an ownership icon; the quiet value `owned` renders nothing.
const OWNERSHIP_ICONS: Partial<Record<Ownership, IconComponent>> = {
  watchlist: ShoppingCartOutlinedIcon,
};

/**
 * Small at-a-glance icons for a game's ownership, progress and hidden status; omits the ownership icon for the
 * quiet `owned` and the hidden icon unless hidden.
 *
 * `variant="full"` (default) shows ownership and progress. `variant="card"` is the compact list form: a watchlist
 * entry shows only the watchlist icon, an owned one only the progress icon. The hidden icon is unaffected.
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
  const showProgress = variant === "full" || !OwnershipIcon;
  const ProgressIcon = PROGRESS_ICONS[progress];

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
      {OwnershipIcon && (
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
