import { useState } from "react";
import { Box, FormHelperText, FormLabel, Rating, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { validateRating } from "../../domain/gameValues";

interface RatingFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  showErrors?: boolean;
}

/** Star rating in quarter-star steps; `null` means "not rated yet". */
export function RatingField({ value, onChange, disabled, showErrors }: RatingFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const label = t("games.fields.rating");
  const code = validateRating(value);
  const showError = code !== null && (touched || showErrors);
  return (
    <Box
      role="group"
      aria-label={label}
      onBlur={() => setTouched(true)}
      sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
    >
      <FormLabel component="legend" error={showError} sx={{ fontSize: "0.75rem" }}>
        {label}
      </FormLabel>
      <Rating
        precision={0.25}
        value={value}
        onChange={(_event, newValue) => {
          setTouched(true);
          onChange(newValue);
        }}
        disabled={disabled}
      />
      <Typography color="text.secondary" variant="body2">
        {value === null ? t("games.notRated") : value}
      </Typography>
      {showError && <FormHelperText error>{t(`validation.${code}`)}</FormHelperText>}
    </Box>
  );
}
