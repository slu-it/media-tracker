import { IconButton, InputAdornment, TextField } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { useTranslation } from "react-i18next";
import { SEARCH_MAX_LENGTH } from "../domain/gameValues";

interface GameSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onSubmit?: () => void;
  /** Fills the parent's width instead of the default `{ xs: 1, sm: 320 }`; for callers (e.g. `GamesViewHeader`'s
   *  wider search row) that size the field through a wrapping `Box` instead. */
  fullWidth?: boolean;
}

/** Controlled search box for the games list; Enter submits immediately instead of waiting for the debounce. */
export function GameSearchField({ value, onChange, onClear, onSubmit, fullWidth }: GameSearchFieldProps) {
  const { t } = useTranslation();
  return (
    <TextField
      type="search"
      size="small"
      autoComplete="off"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSubmit?.();
      }}
      placeholder={t("games.search.placeholder")}
      slotProps={{
        htmlInput: { "aria-label": t("games.search.label"), maxLength: SEARCH_MAX_LENGTH },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: value.length > 0 && (
            <InputAdornment position="end">
              <IconButton aria-label={t("games.search.clear")} onClick={onClear} edge="end" size="small">
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
      sx={{
        width: fullWidth ? 1 : { xs: 1, sm: 320 },
        "& input::-webkit-search-cancel-button": { WebkitAppearance: "none" },
      }}
    />
  );
}
