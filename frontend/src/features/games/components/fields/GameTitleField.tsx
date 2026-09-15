import { useState } from "react";
import { TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { TITLE_MAX_LENGTH, validateTitle } from "../../domain/gameValues";

interface GameTitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Show errors even before the field was touched (e.g. after a save attempt). */
  showErrors?: boolean;
  autoFocus?: boolean;
}

/** Title input with the domain constraints (non-empty, at most 256 characters) built in. */
export function GameTitleField({ value, onChange, disabled, showErrors, autoFocus }: GameTitleFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = validateTitle(value);
  const showError = code !== null && (touched || showErrors);
  return (
    <TextField
      label={t("games.fields.title")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setTouched(true)}
      required
      fullWidth
      disabled={disabled}
      autoFocus={autoFocus}
      error={showError}
      helperText={
        showError ? t(`validation.${code}`, { max: TITLE_MAX_LENGTH }) : `${value.trim().length}/${TITLE_MAX_LENGTH}`
      }
      slotProps={{ htmlInput: { maxLength: TITLE_MAX_LENGTH } }}
    />
  );
}
