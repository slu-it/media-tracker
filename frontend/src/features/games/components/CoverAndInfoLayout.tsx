import type { ReactNode } from "react";
import { Box } from "@mui/material";

/** Dialog body layout: cover on the left, content on the right, roughly 1:2; stacks on narrow screens. */
export function CoverAndInfoLayout({
  cover,
  underCover,
  children,
}: {
  cover: ReactNode;
  underCover?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr" }, gap: 3, alignItems: "start" }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        {cover}
        {underCover}
      </Box>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}
