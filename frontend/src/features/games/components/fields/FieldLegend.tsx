import type { ReactNode } from "react";
import { FormLabel } from "@mui/material";

interface FieldLegendProps {
  id?: string;
  error?: boolean;
  children: ReactNode;
}

/**
 * Small label above a grouped control (rating, progress); shared so the styling stays identical. A `span`, not a
 * `<legend>` (there is no fieldset); the group names itself through `aria-labelledby` pointing at `id`.
 */
export function FieldLegend({ id, error, children }: FieldLegendProps) {
  return (
    <FormLabel component="span" id={id} error={error} sx={{ fontSize: "0.75rem" }}>
      {children}
    </FormLabel>
  );
}
