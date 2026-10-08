import { useTranslation } from "react-i18next";
import { VocabularyField } from "../../../../components/media/fields/VocabularyField";
import { searchBookNarrators } from "../../api/booksApi";
import type { NarratorDraft } from "../../domain/bookDraft";

interface NarratorsFieldProps {
  value: NarratorDraft[];
  onChange: (value: NarratorDraft[]) => void;
  disabled?: boolean;
}

/** The book narrators: `VocabularyField` over `/api/book-narrators` with the books label and hint. */
export function NarratorsField({ value, onChange, disabled }: NarratorsFieldProps) {
  const { t } = useTranslation();
  return (
    <VocabularyField
      value={value}
      onChange={onChange}
      disabled={disabled}
      fetchSuggestions={searchBookNarrators}
      label={t("books.fields.narrators")}
      hint={t("books.fields.narratorsHint")}
    />
  );
}
