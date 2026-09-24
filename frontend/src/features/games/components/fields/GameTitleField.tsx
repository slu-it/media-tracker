import { useState } from "react";
import { Autocomplete, Box, TextField, Typography } from "@mui/material";
import VerifiedIcon from "@mui/icons-material/Verified";
import { useTranslation } from "react-i18next";
import type { CoverMatchResponse } from "../../../../types/api";
import { TITLE_MAX_LENGTH, validateTitle } from "../../domain/gameValues";
import { useTitleSuggestions } from "../../hooks/useTitleSuggestions";

interface GameTitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Reports a picked suggestion; the host decides what to do with it (e.g. also filling the release year).
   * Also gates the suggestion feature itself: omitting it (e.g. `ExpansionDialog`'s DLC title, which reuses
   * this field) means no title-suggestions request is ever made, since SteamGridDB only knows games, not DLC,
   * and the field falls back to a plain `TextField` with textbox semantics.
   */
  onSuggestionPick?: (suggestion: CoverMatchResponse) => void;
  disabled?: boolean;
  /** Show errors even before the field was touched (e.g. after a save attempt). */
  showErrors?: boolean;
  autoFocus?: boolean;
  /** Debounce before a suggestion request fires; tests pass a short value to stay on real timers. */
  suggestionDebounceMs?: number;
}

/**
 * Title input with the domain constraints (non-empty, at most 256 characters) built in, plus SteamGridDB title
 * suggestions once the user has actually edited the title (opening an edit form with an existing title costs no
 * request) and the host opted in via `onSuggestionPick`. `freeSolo` `Autocomplete` keeps typing a plain title the
 * normal case; picking a suggestion is reported via `onSuggestionPick` instead of being applied here, so the host
 * can also fill the release year atomically. Without `onSuggestionPick` (DLC titles, see above), this renders a
 * plain `TextField` instead, keeping textbox semantics and never touching the suggestions hook's request.
 */
export function GameTitleField({
  value,
  onChange,
  onSuggestionPick,
  disabled,
  showErrors,
  autoFocus,
  suggestionDebounceMs,
}: GameTitleFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const [userEdited, setUserEdited] = useState(false);
  // The name last applied by a pick: fetching stays off while the (unchanged) value still matches it, so
  // accepting a suggestion never immediately re-triggers a search for the very name it just filled in. Typing
  // clears it again (see `onInputChange` below).
  const [lastPicked, setLastPicked] = useState<string | null>(null);
  const code = validateTitle(value);
  const showError = code !== null && (touched || showErrors);
  const suggestionsEnabled = userEdited && onSuggestionPick !== undefined && value !== lastPicked;
  const suggestions = useTitleSuggestions(value, suggestionsEnabled, suggestionDebounceMs);
  const options = suggestions.filter((suggestion) => suggestion.name !== value);
  const helperText = showError
    ? t(`validation.${code}`, { max: TITLE_MAX_LENGTH })
    : `${value.trim().length}/${TITLE_MAX_LENGTH}`;

  if (onSuggestionPick === undefined) {
    return (
      <TextField
        fullWidth
        disabled={disabled}
        label={t("games.fields.title")}
        required
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setTouched(true)}
        error={showError}
        helperText={helperText}
        slotProps={{ htmlInput: { maxLength: TITLE_MAX_LENGTH } }}
      />
    );
  }

  return (
    <Autocomplete<CoverMatchResponse, false, true, true>
      freeSolo
      fullWidth
      disableClearable
      disabled={disabled}
      options={options}
      filterOptions={(x) => x}
      // No `value` prop: the Autocomplete must not own a selected value of its own, because the title is driven
      // solely by `inputValue` below (a pick is never mirrored into `value` either). `disableClearable` requires
      // its type to exclude `null`, so this is left uncontrolled instead of forced to `null`; MUI's own internal
      // selection is still never read anywhere here, and stays irrelevant to what the field renders or reports.
      inputValue={value}
      getOptionLabel={(option) => (typeof option === "string" ? option : option.name)}
      onInputChange={(_event, newValue, reason) => {
        // Only real typing ("input") is acted on here. A pick arrives through `onChange` below instead, with the
        // host's `onSuggestionPick` applying it (the resulting new `value` prop then flows back into `inputValue`
        // above); "reset" and "blur" fire on every close/blur with a value this component must not touch. There
        // is no "clear" to ignore: `disableClearable` removes MUI's clear button, matching the plain `TextField`
        // branch above, which never had one either.
        if (reason !== "input") return;
        onChange(newValue);
        setLastPicked(null);
        setUserEdited(true);
      }}
      onChange={(_event, newValue) => {
        if (newValue !== null && typeof newValue !== "string") {
          setLastPicked(newValue.name);
          onSuggestionPick(newValue);
        }
      }}
      onBlur={() => setTouched(true)}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <Box component="li" key={key} {...optionProps}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {option.releaseYear !== null ? `${option.name} · ${option.releaseYear}` : option.name}
              </Typography>
              {option.verified && (
                <VerifiedIcon fontSize="small" color="action" titleAccess={t("games.fields.titleSuggestionVerified")} />
              )}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("games.fields.title")}
          required
          autoFocus={autoFocus}
          error={showError}
          helperText={helperText}
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps.htmlInput, maxLength: TITLE_MAX_LENGTH },
          }}
        />
      )}
    />
  );
}
