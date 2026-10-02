import type { ReactNode } from "react";
import { Box } from "@mui/material";

/**
 * Container of the results row's `facts` slot (overview filters, watchlist sort and platform): a wrapping flex row,
 * bottom-aligned so toggle bar bottoms and select underlines share a line.
 */
export function FilterRow({ children }: { children: ReactNode }) {
  return <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 3 }}>{children}</Box>;
}
