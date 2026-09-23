import type { SxProps, Theme } from "@mui/material";

/**
 * Visible keyboard focus outline for `ButtonBase`-based controls, which reset the browser's default outline.
 * Spread into a component's `sx` alongside its own rules.
 */
export const focusVisibleRingSx: SxProps<Theme> = {
  "&.Mui-focusVisible": {
    outline: (theme) => `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
};
