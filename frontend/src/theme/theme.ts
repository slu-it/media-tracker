import { createTheme } from "@mui/material/styles";

/*
 * The palette mirrors the hand-written login page (backend/src/main/resources/login/login.css) so both surfaces
 * look like one application. Light/dark follow the mode stored by the header toggle (src/theme/mode.ts),
 * defaulting to the OS preference until the user picks one explicitly. The font stack is the system one: the app
 * is self-hosted and loads nothing from a CDN.
 */
export const appTheme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#1f3a5f" },
        background: { default: "#f4f6fa", paper: "#ffffff" },
        text: { primary: "#1c2331", secondary: "#6b7686" },
        divider: "#d4dae3",
      },
    },
    dark: {
      palette: {
        primary: { main: "#7fa7d8" },
        background: { default: "#121721", paper: "#1b2230" },
        text: { primary: "#e6eaf1", secondary: "#97a1b1" },
        divider: "#2d3646",
      },
    },
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  shape: { borderRadius: 10 },
});
