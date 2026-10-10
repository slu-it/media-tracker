import { useState, type ReactNode } from "react";
import { Autocomplete, Box, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { TITLE_MAX_LENGTH, validateTitle } from "../../../domain/media/values";
import { useTitleSuggestions } from "../../../hooks/useTitleSuggestions";

export interface SuggestingTitleFieldProps<S> {
  value: string;
  onChange: (value: string) => void;
  /** Reports a picked suggestion; the host decides what to fill (e.g. also the release year). */
  onSuggestionPick: (suggestion: S) => void;
  /** See `useTitleSuggestions`. */
  fetchSuggestions: (query: string) => Promise<S[]>;
  requestKey: string;
  minLength: number;
  /** The text a pick puts into the title; also hides a suggestion equal to the current value (see `hideExactMatch`). */
  getOptionName: (suggestion: S) => string;
  /** Unique key per option when names can repeat; defaults to the name. */
  getOptionKey?: (suggestion: S) => string | number;
  renderOptionLabel: (suggestion: S) => ReactNode;
  /** Optional trailing content of an option row (e.g. a "verified" icon). */
  renderOptionEnd?: (suggestion: S) => ReactNode;
  /**
   * Hide a suggestion whose name equals the current title (default true). Kinds whose suggestions carry more than
   * the name (books: author, year) turn it off so the exact match stays pickable.
   */
  hideExactMatch?: boolean;
  disabled?: boolean;
  /** Show errors even before the field was touched (e.g. after a save attempt). */
  showErrors?: boolean;
  autoFocus?: boolean;
}

/**
 * Title input with the domain constraints (non-empty, at most 256 characters) built in, plus title suggestions
 * once the user has actually edited the title (opening an edit form with an existing title costs no request).
 * `freeSolo` `Autocomplete` keeps typing a plain title the normal case; picking a suggestion is reported via
 * `onSuggestionPick` instead of being applied here, so the host can also fill other fields atomically.
 */
export function SuggestingTitleField<S>({
  value,
  onChange,
  onSuggestionPick,
  fetchSuggestions,
  requestKey,
  minLength,
  getOptionName,
  getOptionKey,
  renderOptionLabel,
  renderOptionEnd,
  hideExactMatch = true,
  disabled,
  showErrors,
  autoFocus,
}: SuggestingTitleFieldProps<S>) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const [userEdited, setUserEdited] = useState(false);
  // The name last applied by a pick: fetching stays off while the (unchanged) value still matches it, so
  // accepting a suggestion never immediately re-triggers a search for the very name it just filled in. Typing
  // clears it again (see `onInputChange` below).
  const [lastPicked, setLastPicked] = useState<string | null>(null);
  const code = validateTitle(value);
  const showError = code !== null && (touched || showErrors);
  const suggestionsEnabled = userEdited && value !== lastPicked;
  const suggestions = useTitleSuggestions(value, suggestionsEnabled, { fetchSuggestions, requestKey, minLength });
  const options = hideExactMatch
    ? suggestions.filter((suggestion) => getOptionName(suggestion) !== value)
    : suggestions;
  const helperText = showError
    ? t(`validation.${code}`, { max: TITLE_MAX_LENGTH })
    : `${value.trim().length}/${TITLE_MAX_LENGTH}`;

  return (
    <Autocomplete<S, false, true, true>
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
      getOptionLabel={(option) => (typeof option === "string" ? option : getOptionName(option))}
      getOptionKey={(option) =>
        typeof option === "string" ? option : getOptionKey ? getOptionKey(option) : getOptionName(option)
      }
      onInputChange={(_event, newValue, reason) => {
        // Only real typing ("input") is acted on here. A pick arrives through `onChange` below instead, with the
        // host's `onSuggestionPick` applying it (the resulting new `value` prop then flows back into `inputValue`
        // above); "reset" and "blur" fire on every close/blur with a value this component must not touch. There
        // is no "clear" to ignore: `disableClearable` removes MUI's clear button.
        if (reason !== "input") return;
        onChange(newValue);
        setLastPicked(null);
        setUserEdited(true);
      }}
      onChange={(_event, newValue) => {
        if (newValue !== null && typeof newValue !== "string") {
          setLastPicked(getOptionName(newValue));
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
                {renderOptionLabel(option)}
              </Typography>
              {renderOptionEnd?.(option)}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("media.fields.title")}
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
