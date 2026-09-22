import { createTheme } from "@mui/material/styles";

/** Dropdown menus scroll after this many options instead of growing towards the full viewport height. */
export const MENU_MAX_ITEMS = 6;
/** Height of one option row: a MenuItem / Autocomplete option is 6px padding around a 24px line box. */
const MENU_ITEM_HEIGHT = 36;
/** Vertical padding of the menu list / Autocomplete listbox (8px top + 8px bottom). */
const MENU_LIST_PADDING = 16;
const MENU_MAX_HEIGHT = MENU_MAX_ITEMS * MENU_ITEM_HEIGHT + MENU_LIST_PADDING;

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
  components: {
    // Every dropdown is capped here, so feature code never sets a menu height itself.
    MuiSelect: {
      defaultProps: {
        MenuProps: { slotProps: { paper: { sx: { maxHeight: MENU_MAX_HEIGHT } } } },
      },
    },
    MuiAutocomplete: {
      styleOverrides: { listbox: { maxHeight: MENU_MAX_HEIGHT } },
    },
  },
});
