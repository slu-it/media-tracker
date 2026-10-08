import { useState } from "react";
import { MenuItem, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { RELEASE_YEAR_SELECT_MIN, releaseYearOptions, validateReleaseYear } from "../../../domain/media/values";

interface ReleaseYearFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  showErrors?: boolean;
  /** Oldest selectable year; defaults to `RELEASE_YEAR_SELECT_MIN`. */
  minYear?: number;
}

/** Year dropdown from the current year back to `minYear` (generated, not listed). */
export function ReleaseYearField({
  value,
  onChange,
  disabled,
  showErrors,
  minYear = RELEASE_YEAR_SELECT_MIN,
}: ReleaseYearFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = validateReleaseYear(value);
  const showError = code !== null && (touched || showErrors);
  const options = releaseYearOptions(minYear);
  // A stored year outside the selectable range (created through the API) must still be displayable.
  if (value !== null && !options.includes(value)) options.push(value);

  return (
    <TextField
      select
      label={t("media.fields.releaseYear")}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      onBlur={() => setTouched(true)}
      required
      fullWidth
      disabled={disabled}
      error={showError}
      helperText={showError ? t(`validation.${code}`) : " "}
    >
      {options.map((year) => (
        <MenuItem key={year} value={year}>
          {year}
        </MenuItem>
      ))}
    </TextField>
  );
}
