import { useState } from "react";
import { InputAdornment, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { normalizeHexColor, validateHexColor } from "../../../domain/media/values";

interface HexColorFieldProps {
  /** The color as `RRGGBB` (or as typed, while invalid); no `#`. */
  value: string;
  /** Receives the normalised input (trimmed, no `#`, uppercase). */
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  /** Show errors even before the field was touched. */
  showErrors?: boolean;
  autoFocus?: boolean;
}

/** Hex color input with a `#` adornment; accepts input with or without `#` and requires exactly six hex digits. */
export function HexColorField({ value, onChange, label, disabled, showErrors, autoFocus }: HexColorFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = validateHexColor(value);
  const showError = code !== null && (touched || showErrors);
  return (
    <TextField
      fullWidth
      size="small"
      disabled={disabled}
      label={label}
      autoFocus={autoFocus}
      value={value}
      onChange={(event) => onChange(normalizeHexColor(event.target.value))}
      onBlur={() => setTouched(true)}
      error={showError}
      helperText={showError ? t(`validation.${code}`) : " "}
      slotProps={{
        input: { startAdornment: <InputAdornment position="start">#</InputAdornment> },
        htmlInput: { maxLength: 7, spellCheck: false, autoComplete: "off" },
      }}
    />
  );
}
