import type { BookTitleSuggestionResponse } from "../../../types/api";
import type { BookDraft } from "./bookDraft";

const MAX_LISTED_AUTHORS = 2;

/** `Title · Author(s) · Year`: at most two authors, then an ellipsis; missing parts are left out. */
export function suggestionLabel(suggestion: BookTitleSuggestionResponse): string {
  const authors =
    suggestion.authors.length > MAX_LISTED_AUTHORS
      ? `${suggestion.authors.slice(0, MAX_LISTED_AUTHORS).join(", ")}…`
      : suggestion.authors.join(", ");
  return [suggestion.name, authors, suggestion.releaseYear === null ? "" : String(suggestion.releaseYear)]
    .filter((part) => part !== "")
    .join(" · ");
}

/**
 * Applies a picked suggestion to the draft: the title always (the user typed it), everything else only into
 * empty fields, so a pick never overwrites what the user already entered. Authors and narrators become pending
 * (free-solo) chips, which the host resolves to vocabulary entries on save.
 */
export function applyBookSuggestion(draft: BookDraft, suggestion: BookTitleSuggestionResponse): BookDraft {
  return {
    ...draft,
    title: suggestion.name,
    releaseYear: draft.releaseYear === null && draft.releaseDate === null ? suggestion.releaseYear : draft.releaseYear,
    authors: draft.authors.length === 0 ? suggestion.authors.map((name) => ({ name })) : draft.authors,
    narrators: draft.narrators.length === 0 ? suggestion.narrators.map((name) => ({ name })) : draft.narrators,
  };
}
