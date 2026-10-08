import LibraryAddOutlinedIcon from "@mui/icons-material/LibraryAddOutlined";
import LibraryAddCheckOutlinedIcon from "@mui/icons-material/LibraryAddCheckOutlined";
import type { BookOwnership } from "../domain/bookStatus";
import type { IconComponent } from "../../../components/media/status/iconComponent";

/** Shared by the book row icons, the `BookStatusFilterToggles` icon bar and `BookOwnershipToggleBar`. Every ownership value has an icon. */
export const BOOK_OWNERSHIP_ICONS: Record<BookOwnership, IconComponent> = {
  watchlist: LibraryAddOutlinedIcon,
  owned: LibraryAddCheckOutlinedIcon,
};
