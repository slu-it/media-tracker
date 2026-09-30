import LibraryAddOutlinedIcon from "@mui/icons-material/LibraryAddOutlined";
import LibraryAddCheckOutlinedIcon from "@mui/icons-material/LibraryAddCheckOutlined";
import type { Ownership } from "../domain/gameStatus";
import type { IconComponent } from "./progressIcons";

/** Shared by the game row icons, the ownership filter menu and `OwnershipSwitch`. Every ownership value has an icon. */
export const OWNERSHIP_ICONS: Record<Ownership, IconComponent> = {
  watchlist: LibraryAddOutlinedIcon,
  owned: LibraryAddCheckOutlinedIcon,
};
