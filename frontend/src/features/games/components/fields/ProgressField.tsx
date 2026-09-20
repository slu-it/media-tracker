import { MenuItem, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { type Progress, PROGRESS_VALUES } from "../../domain/gameStatus";

interface ProgressFieldProps {
  value: Progress;
  onChange: (value: Progress) => void;
  disabled?: boolean;
}

/** Progress dropdown; the offered values are always valid, so there is no error state. */
export function ProgressField({ value, onChange, disabled }: ProgressFieldProps) {
  const { t } = useTranslation();

  return (
    <TextField
      select
      label={t("games.fields.progress")}
      value={value}
      onChange={(event) => onChange(event.target.value as Progress)}
      fullWidth
      disabled={disabled}
    >
      {PROGRESS_VALUES.map((progress) => (
        <MenuItem key={progress} value={progress}>
          {t(`games.progress.${progress}`)}
        </MenuItem>
      ))}
    </TextField>
  );
}
