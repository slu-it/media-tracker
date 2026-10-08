import { useState } from "react";
import { TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { TITLE_MAX_LENGTH, validateTitle } from "../../../domain/media/values";

interface TitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Show errors even before the field was touched (e.g. after a save attempt). */
  showErrors?: boolean;
  autoFocus?: boolean;
}

/** Plain title input with the domain constraints (non-empty, at most 256 characters) built in. */
export function TitleField({ value, onChange, disabled, showErrors, autoFocus }: TitleFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = validateTitle(value);
  const showError = code !== null && (touched || showErrors);
  const helperText = showError
    ? t(`validation.${code}`, { max: TITLE_MAX_LENGTH })
    : `${value.trim().length}/${TITLE_MAX_LENGTH}`;

  return (
    <TextField
      fullWidth
      disabled={disabled}
      label={t("media.fields.title")}
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
