import { useState } from "react";
import { TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { VOCABULARY_NAME_MAX_LENGTH, validateVocabularyName } from "../../../domain/media/values";

interface VocabularyNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  /** Show errors even before the field was touched (e.g. after a save attempt). */
  showErrors?: boolean;
  autoFocus?: boolean;
}

/** Plain name input for a vocabulary entry (author, series) with the domain constraints (non-empty, at most 128 characters) built in. */
export function VocabularyNameField({
  value,
  onChange,
  label,
  disabled,
  showErrors,
  autoFocus,
}: VocabularyNameFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = validateVocabularyName(value);
  const showError = code !== null && (touched || showErrors);
  return (
    <TextField
      fullWidth
      disabled={disabled}
      label={label}
      autoFocus={autoFocus}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setTouched(true)}
      error={showError}
      helperText={showError ? t(`validation.${code}`, { max: VOCABULARY_NAME_MAX_LENGTH }) : " "}
    />
  );
}
