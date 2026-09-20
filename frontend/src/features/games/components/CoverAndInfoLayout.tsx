import type { ReactNode } from "react";
import { Box } from "@mui/material";

interface CoverAndInfoLayoutProps {
  cover: ReactNode;
  underCover?: ReactNode;
  children: ReactNode;
  /**
   * When set, the root grid and the info column no longer size to their content: they participate in the
   * surrounding flex column (`flex: 1`, `minHeight: 0`) and the info column's body scrolls on its own while
   * `infoHeader` stays put. Requires a flex ancestor with a bounded height, as `BaseDialog`'s `contentScroll="children"`
   * content box provides.
   */
  scrollInfo?: boolean;
  /**
   * Header rendered above `children` in the info column. With `scrollInfo` it stays frozen above the scrolling
   * info body (e.g. the title and status icons); without it, it is rendered directly above `children` with
   * today's non-scrolling markup unchanged.
   */
  infoHeader?: ReactNode;
}

/** Dialog body layout: cover on the left, content on the right, roughly 1:2; stacks on narrow screens. */
export function CoverAndInfoLayout({ cover, underCover, children, scrollInfo, infoHeader }: CoverAndInfoLayoutProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr" },
        gap: 3,
        alignItems: scrollInfo ? { xs: "start", sm: "stretch" } : "start",
        ...(scrollInfo && { flex: 1, minHeight: 0 }),
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          ...(scrollInfo && { minHeight: 0, overflow: { xs: "visible", sm: "auto" } }),
        }}
      >
        {cover}
        {underCover}
      </Box>
      {scrollInfo ? (
        <Box sx={{ minWidth: 0, display: { xs: "block", sm: "flex" }, flexDirection: "column", minHeight: 0 }}>
          {infoHeader && <Box sx={{ flexShrink: 0, mb: 1 }}>{infoHeader}</Box>}
          <Box
            sx={{
              minWidth: 0,
              minHeight: 0,
              flex: 1,
              overflow: { xs: "visible", sm: "auto" },
              pr: { sm: 1 },
              py: { sm: 1.5 },
              scrollbarGutter: "stable",
            }}
          >
            {children}
          </Box>
        </Box>
      ) : (
        <Box sx={{ minWidth: 0 }}>
          {infoHeader}
          {children}
        </Box>
      )}
    </Box>
  );
}
