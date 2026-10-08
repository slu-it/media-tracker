import { useTranslation } from "react-i18next";
import { ColoredOptionsField } from "../../../../components/media/fields/ColoredOptionsField";
import type { BookTypeResponse } from "../../../../types/api";

interface BookTypesFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  /** `null` while the types are still loading. */
  options: BookTypeResponse[] | null;
  disabled?: boolean;
  showErrors?: boolean;
}

/** The book types: optional `ColoredOptionsField` (a book needs no type). */
export function BookTypesField({ value, onChange, options, disabled, showErrors }: BookTypesFieldProps) {
  const { t } = useTranslation();
  return (
    <ColoredOptionsField
      value={value}
      onChange={onChange}
      options={options}
      label={t("books.fields.types")}
      required={false}
      disabled={disabled}
      showErrors={showErrors}
    />
  );
}
