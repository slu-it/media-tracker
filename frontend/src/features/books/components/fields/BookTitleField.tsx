import { SuggestingTitleField } from "../../../../components/media/fields/SuggestingTitleField";
import type { BookCoverSource, BookTitleSuggestionResponse } from "../../../../types/api";
import { getBookTitleSuggestions } from "../../api/booksApi";
import { suggestionLabel } from "../../domain/bookSuggestion";
import { BOOK_TITLE_SUGGESTION_MIN_LENGTH } from "../../domain/bookValues";

interface BookTitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Reports a picked suggestion; the host decides which empty fields it fills. */
  onSuggestionPick: (suggestion: BookTitleSuggestionResponse) => void;
  /** Where suggestions come from; a change refetches for the same title. */
  source: BookCoverSource;
  disabled?: boolean;
  /** Show errors even before the field was touched (e.g. after a save attempt). */
  showErrors?: boolean;
  autoFocus?: boolean;
}

/** Title input with the domain constraints built in, plus Open Library / Audible title suggestions. */
export function BookTitleField({ source, ...props }: BookTitleFieldProps) {
  return (
    <SuggestingTitleField<BookTitleSuggestionResponse>
      {...props}
      fetchSuggestions={(query) => getBookTitleSuggestions(query, source).then((data) => data.suggestions)}
      requestKey={source}
      minLength={BOOK_TITLE_SUGGESTION_MIN_LENGTH}
      getOptionName={(suggestion) => suggestion.name}
      getOptionKey={suggestionLabel}
      renderOptionLabel={suggestionLabel}
      hideExactMatch={false}
    />
  );
}
