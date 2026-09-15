import { useState } from "react";
import { TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { DESCRIPTION_MAX_LENGTH, validateDescription } from "../../domain/gameValues";

interface DescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showErrors?: boolean;
}

/** Optional free-text description, bounded to 10000 characters. */
export function DescriptionField({ value, onChange, disabled, showErrors }: DescriptionFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = validateDescription(value);
  const showError = code !== null && (touched || showErrors);
  return (
    <TextField
      label={t("games.fields.description")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setTouched(true)}
      multiline
      minRows={4}
      maxRows={8}
      fullWidth
      disabled={disabled}
      error={showError}
      helperText={
        showError
          ? t(`validation.${code}`, { max: DESCRIPTION_MAX_LENGTH })
          : `${value.trim().length}/${DESCRIPTION_MAX_LENGTH}`
      }
      slotProps={{ htmlInput: { maxLength: DESCRIPTION_MAX_LENGTH } }}
    />
  );
}
