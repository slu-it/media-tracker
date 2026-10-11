import { useState } from "react";
import { TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { validateSeriesPosition } from "../../../domain/media/values";

interface SeriesPositionFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Names the field for assistive technology, e.g. with the series name. */
  ariaLabel?: string;
  /** Show the error before the field was touched (the form's save attempt). */
  showErrors?: boolean;
}

/** Optional position of an item within a series (0 to 9999.99, at most two decimals, "." or ","). */
export function SeriesPositionField({ value, onChange, disabled, ariaLabel, showErrors }: SeriesPositionFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = validateSeriesPosition(value);
  const showError = code !== null && (touched || showErrors);
  return (
    <TextField
      size="small"
      disabled={disabled}
      label={t("media.series.position")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setTouched(true)}
      error={showError}
      helperText={showError ? t(`validation.${code}`) : undefined}
      sx={{ width: 110 }}
      slotProps={{ htmlInput: { inputMode: "decimal", "aria-label": ariaLabel } }}
    />
  );
}
