import { useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ColorChip, type ColorChipItem } from "../ColorChip";

interface ColoredOptionsFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  /** `null` while the option list is still loading. */
  options: ColorChipItem[] | null;
  label: string;
  /** When false an empty selection is valid and no required marker or error shows. */
  required: boolean;
  disabled?: boolean;
  showErrors?: boolean;
}

/** Multi-select over reference options (platforms, book types); selected tags render as the same colored chips as elsewhere. */
export function ColoredOptionsField({
  value,
  onChange,
  options,
  label,
  required,
  disabled,
  showErrors,
}: ColoredOptionsFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = required && value.length === 0 ? "required" : null;
  const showError = code !== null && (touched || showErrors);
  const selected = (options ?? []).filter((option) => value.includes(option.id));

  return (
    <Autocomplete
      multiple
      options={options ?? []}
      value={selected}
      onChange={(_event, selectedOptions) => onChange(selectedOptions.map((option) => option.id))}
      onBlur={() => setTouched(true)}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, other) => option.id === other.id}
      disableCloseOnSelect
      loading={options === null}
      disabled={disabled || options === null}
      renderValue={(selectedOptions, getItemProps) =>
        selectedOptions.map((option, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          return <ColorChip key={key} item={option} {...itemProps} />;
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={showError}
          helperText={showError ? t(`validation.${code}`) : " "}
        />
      )}
    />
  );
}
