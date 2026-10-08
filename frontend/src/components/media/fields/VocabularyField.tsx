import { useState } from "react";
import { Autocomplete, Box, Chip, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { VOCABULARY_NAME_MAX_LENGTH, validateVocabularyName, type ValidationCode } from "../../../domain/media/values";
import { addEntry, type VocabularyDraft } from "../../../domain/media/vocabularyDraft";
import { useVocabularySuggestions } from "../../../hooks/useVocabularySuggestions";
import type { NamedEntry } from "../../../domain/media/vocabularyDraft";

interface VocabularyFieldProps {
  value: VocabularyDraft[];
  onChange: (value: VocabularyDraft[]) => void;
  disabled?: boolean;
  /** Stable (module-level) suggestion lookup, an effect dependency of `useVocabularySuggestions`. */
  fetchSuggestions: (term: string, signal: AbortSignal) => Promise<NamedEntry[]>;
  label: string;
  hint: string;
}

/**
 * Multi-select, free-solo chip input over a create-on-the-fly vocabulary (game developers, book authors): typing
 * offers matching entries from `fetchSuggestions`, and pressing Enter, picking a suggestion, picking the "Add ..."
 * option, or blurring the field all commit the current text the same way: a case-insensitive match of an existing
 * suggestion picks that entry (upgrading a same-named pending chip already selected instead of duplicating it, see
 * `addEntry`), anything else becomes a pending entry (not yet created on the backend, see `VocabularyDraft`)
 * unless it's blank or over the backend's length limit, which is rejected with an error instead of being added.
 * The host form is responsible for turning pending entries into real ones before saving. On blur, if an option is
 * keyboard-highlighted (arrow keys, popup open), `autoSelect` commits that highlighted option instead of the typed
 * text.
 */
export function VocabularyField({ value, onChange, disabled, fetchSuggestions, label, hint }: VocabularyFieldProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<ValidationCode | null>(null);
  const { suggestions, settled } = useVocabularySuggestions(inputValue, fetchSuggestions);
  const suggestionOptions = suggestions.filter(
    (suggestion) => !value.some((selected) => "id" in selected && selected.id === suggestion.id),
  );
  const trimmedInput = inputValue.trim();
  const isAlreadyOfferedOrSelected = (name: string) => {
    const normalized = name.trim().toLowerCase();
    return (
      suggestions.some((suggestion) => suggestion.name.trim().toLowerCase() === normalized) ||
      value.some((selected) => selected.name.trim().toLowerCase() === normalized)
    );
  };
  // Offered only for text that would actually be accepted as a new pending entry (see the `onChange` handler
  // below), and only once `settled` confirms the suggestion lookup for this exact text has actually come back
  // empty - offering it earlier could race a matching suggestion that arrives moments later, prompting to add a
  // entry that already exists.
  const canOfferAdd =
    settled &&
    trimmedInput.length > 0 &&
    validateVocabularyName(trimmedInput) === null &&
    !isAlreadyOfferedOrSelected(trimmedInput);
  const addOption: VocabularyDraft | null = canOfferAdd ? { name: trimmedInput } : null;
  const options = addOption === null ? suggestionOptions : [...suggestionOptions, addOption];

  return (
    <Autocomplete<VocabularyDraft, true, false, true>
      multiple
      freeSolo
      fullWidth
      autoSelect
      disabled={disabled}
      options={options}
      filterOptions={(x) => x}
      value={value}
      inputValue={inputValue}
      onInputChange={(_event, newInputValue, reason) => {
        if (reason !== "input") return;
        setInputValue(newInputValue);
      }}
      getOptionLabel={(option) => (typeof option === "string" ? option : option.name)}
      isOptionEqualToValue={(option, other) => {
        if (typeof option === "string" || typeof other === "string") return option === other;
        // Only two already-existing entries (both with an id) can ever be the same selection. A pending chip
        // (no id yet, see `VocabularyDraft`) never counts as equal to a suggestion of the same name: otherwise
        // clicking that suggestion would read as toggling the pending chip off (MUI's `removeOption` path)
        // instead of upgrading it, see `addEntry`.
        return "id" in option && "id" in other && option.id === other.id;
      }}
      onChange={(_event, newValue, reason) => {
        if (reason === "removeOption" || reason === "clear") {
          onChange(newValue.filter((entry): entry is VocabularyDraft => typeof entry !== "string"));
          setError(null);
          return;
        }
        const raw = newValue[newValue.length - 1];
        if (raw === undefined) return;
        let candidate: VocabularyDraft;
        if (typeof raw === "string") {
          const trimmed = raw.trim();
          const matched = suggestions.find(
            (suggestion) => suggestion.name.trim().toLowerCase() === trimmed.toLowerCase(),
          );
          if (matched !== undefined) {
            candidate = matched;
          } else {
            const code = validateVocabularyName(trimmed);
            if (code !== null) {
              setError(code);
              return;
            }
            candidate = { name: trimmed };
          }
        } else {
          candidate = raw;
        }
        setError(null);
        onChange(addEntry(value, candidate));
        setInputValue("");
      }}
      renderValue={(selected, getItemProps) =>
        selected.map((draft, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          const label = typeof draft === "string" ? draft : draft.name;
          return <Chip key={key} label={label} variant="outlined" size="small" {...itemProps} />;
        })
      }
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <Box component="li" key={key} {...optionProps}>
            {option === addOption ? t("media.vocabulary.add", { name: option.name }) : option.name}
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error !== null}
          helperText={error !== null ? t(`validation.${error}`, { max: VOCABULARY_NAME_MAX_LENGTH }) : hint}
        />
      )}
    />
  );
}
