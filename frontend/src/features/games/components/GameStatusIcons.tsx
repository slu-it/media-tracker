import { Box, Tooltip } from "@mui/material";
import type SvgIcon from "@mui/material/SvgIcon";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import DoNotDisturbIcon from "@mui/icons-material/DoNotDisturb";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useTranslation } from "react-i18next";
import type { Ownership, Progress } from "../domain/gameStatus";

type IconComponent = typeof SvgIcon;

// Only the "loud" values get an icon; the quiet values (owned / not started) render nothing.
const OWNERSHIP_ICONS: Partial<Record<Ownership, IconComponent>> = {
  watchlist: ShoppingCartOutlinedIcon,
};

const PROGRESS_ICONS: Partial<Record<Progress, IconComponent>> = {
  playing: SportsEsportsIcon,
  finished: CheckCircleIcon,
  completed: EmojiEventsIcon,
  paused: PauseCircleIcon,
  abandoned: DoNotDisturbIcon,
};

/**
 * Small at-a-glance icons for a game's ownership, progress and hidden status; renders nothing when all three are
 * quiet (owned, not started, not hidden).
 */
export function GameStatusIcons({
  ownership,
  progress,
  hidden,
}: {
  ownership: Ownership;
  progress: Progress;
  hidden: boolean;
}) {
  const { t } = useTranslation();
  const OwnershipIcon = OWNERSHIP_ICONS[ownership];
  const ProgressIcon = PROGRESS_ICONS[progress];

  if (!OwnershipIcon && !ProgressIcon && !hidden) {
    return null;
  }

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
      {ProgressIcon && (
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
