import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import NotStartedIcon from "@mui/icons-material/NotStarted";
import PauseIcon from "@mui/icons-material/Pause";
import NotInterestedIcon from "@mui/icons-material/NotInterested";
import type { BookProgress } from "../domain/bookStatus";
import type { IconComponent } from "../../../components/media/status/iconComponent";

/** Shared by the book row icons, the progress filter bar and `BookProgressToggleBar`. Every progress value has an icon. */
export const BOOK_PROGRESS_ICONS: Record<BookProgress, IconComponent> = {
  abandoned: NotInterestedIcon,
  not_started: NotStartedIcon,
  paused: PauseIcon,
  reading: AutoStoriesIcon,
  finished: TaskAltIcon,
};
