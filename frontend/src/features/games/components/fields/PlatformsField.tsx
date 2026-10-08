import { useTranslation } from "react-i18next";
import type { GamePlatformResponse } from "../../../../types/api";
import { ColoredOptionsField } from "../../../../components/media/fields/ColoredOptionsField";

interface PlatformsFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  /** `null` while the platform list is still loading. */
  options: GamePlatformResponse[] | null;
  disabled?: boolean;
  showErrors?: boolean;
}

/** Required multi-select over the available platforms (`ColoredOptionsField` with the games label). */
export function PlatformsField({ value, onChange, options, disabled, showErrors }: PlatformsFieldProps) {
  const { t } = useTranslation();
  return (
    <ColoredOptionsField
      value={value}
      onChange={onChange}
      options={options}
      label={t("games.fields.platforms")}
      required
      disabled={disabled}
      showErrors={showErrors}
    />
  );
}
