import { Tooltip } from "@mui/material";
import type { IconComponent } from "./iconComponent";

/** A small secondary-colored status icon whose tooltip and accessible title are `label`. */
export function StatusIcon({ icon: Icon, label }: { icon: IconComponent; label: string }) {
  return (
    <Tooltip title={label}>
      <Icon fontSize="small" titleAccess={label} sx={{ color: "text.secondary" }} />
    </Tooltip>
  );
}
