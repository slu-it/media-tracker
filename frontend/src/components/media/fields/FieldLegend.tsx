import type { ReactNode } from "react";
import { FormLabel, type SxProps, type Theme } from "@mui/material";

interface FieldLegendProps {
  id?: string;
  error?: boolean;
  children: ReactNode;
  /** Extra styles merged after the shared ones (a purely visual offset, say). */
  sx?: SxProps<Theme>;
}

/**
 * Small label above a grouped control (rating, progress); shared so the styling stays identical. A `span`, not a
 * `<legend>` (there is no fieldset); the group names itself through `aria-labelledby` pointing at `id`.
 */
export function FieldLegend({ id, error, children, sx }: FieldLegendProps) {
  return (
    <FormLabel
      component="span"
      id={id}
      error={error}
      sx={[{ fontSize: "0.75rem" }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {children}
    </FormLabel>
  );
}
