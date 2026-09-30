import type SvgIcon from "@mui/material/SvgIcon";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import NotStartedIcon from "@mui/icons-material/NotStarted";
import PauseIcon from "@mui/icons-material/Pause";
import NotInterestedIcon from "@mui/icons-material/NotInterested";
import type { Progress } from "../domain/gameStatus";

export type IconComponent = typeof SvgIcon;

/** Shared by the game row icons, the progress filter menu and `ProgressToggleBar`. Every progress value has an icon. */
export const PROGRESS_ICONS: Record<Progress, IconComponent> = {
  abandoned: NotInterestedIcon,
  not_started: NotStartedIcon,
  paused: PauseIcon,
  playing: SportsEsportsIcon,
  finished: TaskAltIcon,
  completed: EmojiEventsIcon,
};
