import { useState } from "react";
import { MenuItem, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { releaseYearOptions, validateReleaseYear } from "../../domain/gameValues";

interface ReleaseYearFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  showErrors?: boolean;
}

/** Year dropdown from the current year back to 1980 (generated, not listed). */
export function ReleaseYearField({ value, onChange, disabled, showErrors }: ReleaseYearFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = validateReleaseYear(value);
  const showError = code !== null && (touched || showErrors);
  const options = releaseYearOptions();
  // A stored year outside the selectable range (created through the API) must still be displayable.
  if (value !== null && !options.includes(value)) options.push(value);

  return (
    <TextField
      select
      label={t("games.fields.releaseYear")}
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
