import { Box } from "@mui/material";
import type { IconComponent } from "./progressIcons";

/**
 * Fixed 20px slot (the small icon size) before a menu item's label (filter menu), so labels align whether or not an option has an
 * icon. A plain Box, not ListItemIcon: MenuItem's `& .MuiListItemIcon-root { minWidth: 36 }` outranks its `sx`.
 */
export function OptionIconSlot({ icon: Icon }: { icon?: IconComponent }) {
  return (
    <Box sx={{ display: "inline-flex", width: 20, flexShrink: 0, mr: 1, color: "text.secondary" }}>
      {Icon && <Icon fontSize="small" />}
    </Box>
  );
}
