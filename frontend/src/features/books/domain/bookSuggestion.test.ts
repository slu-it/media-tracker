import { describe, expect, it } from "vitest";
import { herbert, simonVance } from "../../../test/fixtures/books";
import type { BookTitleSuggestionResponse } from "../../../types/api";
import { emptyBookDraft } from "./bookDraft";
import { applyBookSuggestion, suggestionLabel } from "./bookSuggestion";

const suggestion: BookTitleSuggestionResponse = {
  name: "Dune",
  authors: ["Frank Herbert"],
  narrators: ["Scott Brick"],
  releaseYear: 1965,
  source: "audiobook",
};

describe("suggestionLabel", () => {
  it("joins title, authors and year", () => {
    expect(suggestionLabel(suggestion)).toBe("Dune · Frank Herbert · 1965");
  });

  it("lists at most two authors, then an ellipsis", () => {
    expect(suggestionLabel({ ...suggestion, authors: ["A", "B", "C"] })).toBe("Dune · A, B… · 1965");
  });

  it("leaves out missing parts", () => {
    expect(suggestionLabel({ ...suggestion, authors: [], releaseYear: null })).toBe("Dune");
  });
});

describe("applyBookSuggestion", () => {
  it("fills every empty field, authors and narrators as pending names", () => {
    expect(applyBookSuggestion({ ...emptyBookDraft(), title: "Dun" }, suggestion)).toEqual({
      ...emptyBookDraft(),
      title: "Dune",
      releaseYear: 1965,
      authors: [{ name: "Frank Herbert" }],
      narrators: [{ name: "Scott Brick" }],
    });
  });

  it("keeps year, authors and narrators that are already set but always sets the title", () => {
    const draft = { ...emptyBookDraft(), title: "Dun", releaseYear: 2000, authors: [herbert], narrators: [simonVance] };
    expect(applyBookSuggestion(draft, suggestion)).toEqual({ ...draft, title: "Dune" });
  });

  it("keeps an unset year when a release date is set", () => {
    const draft = { ...emptyBookDraft(), releaseDate: "2000-01-01" };
    expect(applyBookSuggestion(draft, suggestion).releaseYear).toBeNull();
  });
});
