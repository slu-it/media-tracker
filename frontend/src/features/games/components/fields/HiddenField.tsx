import { Checkbox, FormControlLabel } from "@mui/material";
import { useTranslation } from "react-i18next";

interface HiddenFieldProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

/** Whether the game is hidden from the default game list. */
export function HiddenField({ value, onChange, disabled }: HiddenFieldProps) {
  const { t } = useTranslation();

  return (
    <FormControlLabel
      control={<Checkbox checked={value} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />}
      label={t("games.fields.hidden")}
    />
  );
}
