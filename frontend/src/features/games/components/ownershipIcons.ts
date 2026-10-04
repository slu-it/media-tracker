import LibraryAddOutlinedIcon from "@mui/icons-material/LibraryAddOutlined";
import LibraryAddCheckOutlinedIcon from "@mui/icons-material/LibraryAddCheckOutlined";
import VideoLibraryOutlinedIcon from "@mui/icons-material/VideoLibraryOutlined";
import type { Ownership } from "../domain/gameStatus";
import type { IconComponent } from "./progressIcons";

/**
 * Shared by the game row icons, the `StatusFilterToggles` icon bar and `OwnershipToggleBar`. Every ownership value
 * has an icon.
 */
export const OWNERSHIP_ICONS: Record<Ownership, IconComponent> = {
  watchlist: LibraryAddOutlinedIcon,
  subscription: VideoLibraryOutlinedIcon,
  owned: LibraryAddCheckOutlinedIcon,
};
