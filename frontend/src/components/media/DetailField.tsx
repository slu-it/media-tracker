import type { ReactNode } from "react";
import { Typography } from "@mui/material";

/** A labelled value in a detail view: small overline label above the content. */
export function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Typography variant="overline" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography component="div">{children}</Typography>
    </div>
  );
}
