import { MenuItem, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { type Ownership, OWNERSHIP_VALUES } from "../../domain/gameStatus";

interface OwnershipFieldProps {
  value: Ownership;
  onChange: (value: Ownership) => void;
  disabled?: boolean;
}

/** Ownership status dropdown; the offered values are always valid, so there is no error state. */
export function OwnershipField({ value, onChange, disabled }: OwnershipFieldProps) {
  const { t } = useTranslation();

  return (
    <TextField
      select
      label={t("games.fields.ownership")}
      value={value}
      onChange={(event) => onChange(event.target.value as Ownership)}
      fullWidth
      disabled={disabled}
    >
      {OWNERSHIP_VALUES.map((ownership) => (
        <MenuItem key={ownership} value={ownership}>
          {t(`games.ownership.${ownership}`)}
        </MenuItem>
      ))}
    </TextField>
  );
}
