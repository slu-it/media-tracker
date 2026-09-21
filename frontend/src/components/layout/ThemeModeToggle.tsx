import { IconButton, Tooltip } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { useTranslation } from "react-i18next";

/**
 * Two-state light/dark toggle. The mode starts as "system" (see `AppProviders`), so the OS preference decides
 * until the user clicks the button for the first time; from then on the mode is pinned to whichever state the
 * click resolved to and persisted in localStorage. The icon shown is always the *target* state's icon (the state
 * a click would switch to), not the current one.
 */
export function ThemeModeToggle() {
  const { t } = useTranslation();
  const { mode, systemMode, setMode } = useColorScheme();

  const resolved = (mode === "system" ? systemMode : mode) ?? "light";
  const target = resolved === "dark" ? "light" : "dark";

  return (
    <Tooltip title={t(`theme.switchTo.${target}`)}>
      <IconButton color="inherit" aria-label={t(`theme.switchTo.${target}`)} onClick={() => setMode(target)}>
        {target === "dark" ? <DarkModeIcon /> : <LightModeIcon />}
      </IconButton>
    </Tooltip>
  );
}
