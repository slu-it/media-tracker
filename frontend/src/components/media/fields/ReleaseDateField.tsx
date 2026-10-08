import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { type Dayjs } from "dayjs";
import { RELEASE_DATE_FORMAT } from "../../../domain/media/releaseDate";
import { RELEASE_YEAR_MAX_DIGITS, RELEASE_YEAR_MIN_DIGITS, validateReleaseDate } from "../../../domain/media/values";

const MIN_DATE = dayjs(new Date(RELEASE_YEAR_MIN_DIGITS, 0, 1));
const MAX_DATE = dayjs(new Date(RELEASE_YEAR_MAX_DIGITS, 11, 31));

interface ReleaseDateFieldProps {
  /** ISO-8601 `YYYY-MM-DD`; `null` when only the release year is known. */
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  showErrors?: boolean;
  /**
   * Reports whether the currently typed date is valid, so a parent can block saving while it is not: a rejected
   * edit does not reach `onChange` (see below), so `value` alone cannot tell invalid-and-mid-edit apart from
   * valid-and-unchanged. Called once on every edit, starting from `true` (an untouched field is valid).
   */
  onValidityChange?: (valid: boolean) => void;
}

/**
 * Optional exact release date; picking one also updates the release year (see `withReleaseDate`), so this field
 * never conflicts with `ReleaseYearField`, which is disabled while a date is set. While the typed date is
 * incomplete or invalid (e.g. mid-edit or out of the accepted year range) the last valid committed value is kept
 * so the field does not blank itself out; the resulting mismatch between what is typed and `value` is exactly
 * what the error styling communicates, and `onValidityChange(false)` is what blocks saving.
 */
export function ReleaseDateField({ value, onChange, disabled, showErrors, onValidityChange }: ReleaseDateFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const [pickerInvalid, setPickerInvalid] = useState(false);
  const code = pickerInvalid ? "invalidDate" : validateReleaseDate(value);
  const showError = code !== null && (touched || showErrors);
  const parsedValue = value === null ? null : dayjs(value);

  return (
    <DatePicker
      label={t("media.fields.releaseDate")}
      value={parsedValue}
      onChange={(newValue: Dayjs | null, context) => {
        setTouched(true);
        const invalid = context.validationError !== null;
        setPickerInvalid(invalid);
        onValidityChange?.(!invalid);
        if (newValue === null) {
          onChange(null);
        } else if (!invalid) {
          onChange(newValue.format("YYYY-MM-DD"));
        }
        // else: keep the last committed value, the field keeps showing what was typed.
      }}
      format={RELEASE_DATE_FORMAT}
      minDate={MIN_DATE}
      maxDate={MAX_DATE}
      disabled={disabled}
      slotProps={{
        field: { clearable: true },
        textField: {
          fullWidth: true,
          onBlur: () => setTouched(true),
          error: showError,
          helperText: showError ? t(`validation.${code}`) : " ",
        },
      }}
    />
  );
}
