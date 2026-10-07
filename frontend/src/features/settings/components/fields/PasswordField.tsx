import { useState } from "react";
import { TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, type ValidationCode } from "../../domain/passwordValues";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The field's own validator (current/new/confirm each use a different one; see `passwordValues.ts`). */
  validate: (value: string) => ValidationCode | null;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  /** Show the validator's error even before the field was touched (e.g. after a failed submit attempt). */
  showErrors?: boolean;
  /**
   * A server-side error (the wrong-password answer on the current-password field) that takes precedence over the
   * validator's own message; the host clears it as soon as the user edits the field again.
   */
  externalError?: string | null;
}

/** Password input following the `GameTitleField` self-validating pattern, reused for all three fields in `PasswordTab`. */
export function PasswordField({
  label,
  value,
  onChange,
  validate,
  autoComplete,
  disabled,
  showErrors,
  externalError,
}: PasswordFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = validate(value);
  const showError = externalError != null || (code !== null && (touched || showErrors));
  const helperText =
    externalError ??
    (code !== null && (touched || showErrors)
      ? t(`validation.${code}`, { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
      : undefined);

  return (
    <TextField
      type="password"
      fullWidth
      required
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setTouched(true)}
      disabled={disabled}
      error={showError}
      helperText={helperText}
      autoComplete={autoComplete}
    />
  );
}
