import { useState } from "react";
import { TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { COVER_URL_MAX_LENGTH, validateCoverImageUrl } from "../../domain/gameValues";

interface CoverImageUrlFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showErrors?: boolean;
}

/** Optional cover URL: empty is fine, anything else must be an absolute http(s) URL. */
export function CoverImageUrlField({ value, onChange, disabled, showErrors }: CoverImageUrlFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = validateCoverImageUrl(value);
  const showError = code !== null && (touched || showErrors);
  return (
    <TextField
      type="url"
      label={t("games.fields.coverImageUrl")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setTouched(true)}
      fullWidth
      disabled={disabled}
      error={showError}
      helperText={
        showError ? t(`validation.${code}`, { max: COVER_URL_MAX_LENGTH }) : t("games.fields.coverImageUrlHint")
      }
      slotProps={{ htmlInput: { inputMode: "url", maxLength: COVER_URL_MAX_LENGTH } }}
    />
  );
}
