import { useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GamePlatformResponse } from "../../../../types/api";
import { validatePlatformIds } from "../../domain/gameValues";
import { PlatformChip } from "../PlatformChip";

interface PlatformsFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  /** `null` while the platform list is still loading. */
  options: GamePlatformResponse[] | null;
  disabled?: boolean;
  showErrors?: boolean;
}

/** Multi-select over the available platforms; selected tags render as the same colored chips as elsewhere. */
export function PlatformsField({ value, onChange, options, disabled, showErrors }: PlatformsFieldProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const code = validatePlatformIds(value);
  const showError = code !== null && (touched || showErrors);
  const selected = (options ?? []).filter((platform) => value.includes(platform.id));

  return (
    <Autocomplete
      multiple
      options={options ?? []}
      value={selected}
      onChange={(_event, selectedOptions) => onChange(selectedOptions.map((platform) => platform.id))}
      onBlur={() => setTouched(true)}
      getOptionLabel={(platform) => platform.label}
      isOptionEqualToValue={(option, other) => option.id === other.id}
      disableCloseOnSelect
      loading={options === null}
      disabled={disabled || options === null}
      renderValue={(selectedPlatforms, getItemProps) =>
        selectedPlatforms.map((platform, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          return <PlatformChip key={key} platform={platform} {...itemProps} />;
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("games.fields.platforms")}
          required
          error={showError}
          helperText={showError ? t(`validation.${code}`) : " "}
        />
      )}
    />
  );
}
