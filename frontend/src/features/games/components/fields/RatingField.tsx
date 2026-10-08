import { useId, useState } from "react";
import { Box, FormHelperText, Rating, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { validateRating } from "../../domain/gameValues";
import { FieldLegend } from "../../../../components/media/fields/FieldLegend";

interface RatingFieldProps {
  value: number | null;
  /** Not needed when `readOnly`. */
  onChange?: (value: number | null) => void;
  /** Disables the stars (edit form while saving). */
  disabled?: boolean;
  /**
   * Blocks changes while a quick save is in flight without `disabled`, which would drop keyboard focus: changes are
   * ignored in the handler and the group is marked `aria-busy` and dimmed, like `ProgressToggleBar`.
   */
  busy?: boolean;
  showErrors?: boolean;
  /** Display-only stars, no radios; same markup as the editable field. */
  readOnly?: boolean;
}

/** Star rating in quarter-star steps; `null` means "not rated yet". */
export function RatingField({ value, onChange, disabled, busy, showErrors, readOnly }: RatingFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  // Hovered star value (mouse only) from MUI's `onChangeActive`; -1 when none. Mirrors MUI's internal hover, so it is
  // never reset on our own: MUI only reports changes of its hover.
  const [hover, setHover] = useState(-1);
  const interactive = !readOnly && !disabled && !busy;
  const shown = interactive && hover !== -1 ? hover : value;
  const legendId = useId();
  const label = t("games.fields.rating");
  const code = validateRating(value);
  const showError = code !== null && (touched || showErrors);
  return (
    <Box
      role="group"
      aria-labelledby={legendId}
      aria-busy={busy || undefined}
      onBlur={() => setTouched(true)}
      sx={[
        { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
        !!busy && { opacity: 0.6, pointerEvents: "none" },
      ]}
    >
      <FieldLegend id={legendId} error={showError}>
        {label}
      </FieldLegend>
      <Rating
        precision={0.25}
        value={value}
        readOnly={readOnly}
        onChange={(_event, newValue) => {
          // MUI's clear sets its internal hover to -1 without calling `onChangeActive`.
          if (newValue === null) setHover(-1);
          if (busy) return;
          setTouched(true);
          onChange?.(newValue);
        }}
        onChangeActive={(_event, newHover) => {
          setHover(newHover);
        }}
        disabled={disabled}
      />
      <Typography color="text.secondary" variant="body2">
        {shown === null ? t("games.notRated") : shown}
      </Typography>
      {showError && <FormHelperText error>{t(`validation.${code}`)}</FormHelperText>}
    </Box>
  );
}
