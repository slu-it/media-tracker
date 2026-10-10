import type { Theme } from "@mui/material";

/** Background from an `associatedColor` (hex without `#`) and the text color picked for contrast against it. */
export function chipColors(theme: Theme, associatedColor: string): { bgcolor: string; color: string } {
  const bgcolor = `#${associatedColor}`;
  return { bgcolor, color: theme.palette.getContrastText(bgcolor) };
}
