import { useState } from "react";
import { TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { AUTHORIZATION_CODE_MAX_LENGTH, validateAuthorizationCode } from "../../domain/dropboxValues";

interface AuthorizationCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * The one-time code pasted from Dropbox's authorization page (mirrors `AuthorizationCode`: non-blank, at most
 * 512 characters). Shows its own error only once touched, in the style of `games/components/fields/*`.
 */
export function AuthorizationCodeField({ value, onChange, disabled }: AuthorizationCodeFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = validateAuthorizationCode(value);
  const showError = code !== null && touched;

  return (
    <TextField
      fullWidth
      size="small"
      disabled={disabled}
      label={t("settings.exportImport.dropbox.codeLabel")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setTouched(true)}
      error={showError}
      helperText={
        showError
          ? t(`validation.${code}`, { max: AUTHORIZATION_CODE_MAX_LENGTH })
          : t("settings.exportImport.dropbox.codeHint")
      }
      slotProps={{ htmlInput: { maxLength: AUTHORIZATION_CODE_MAX_LENGTH } }}
    />
  );
}
