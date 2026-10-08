import { useTranslation } from "react-i18next";
import { VocabularyField } from "../../../../components/media/fields/VocabularyField";
import { searchBookAuthors } from "../../api/booksApi";
import type { AuthorDraft } from "../../domain/bookDraft";

interface AuthorsFieldProps {
  value: AuthorDraft[];
  onChange: (value: AuthorDraft[]) => void;
  disabled?: boolean;
}

/** The book authors: `VocabularyField` over `/api/book-authors` with the books label and hint. */
export function AuthorsField({ value, onChange, disabled }: AuthorsFieldProps) {
  const { t } = useTranslation();
  return (
    <VocabularyField
      value={value}
      onChange={onChange}
      disabled={disabled}
      fetchSuggestions={searchBookAuthors}
      label={t("books.fields.authors")}
      hint={t("books.fields.authorsHint")}
    />
  );
}
