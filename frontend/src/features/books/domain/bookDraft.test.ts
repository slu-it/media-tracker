import { describe, expect, it } from "vitest";
import type { BookResponse } from "../../../types/api";
import { dune, herbert, hardcover, kindle, leGuin, paperback } from "../../../test/fixtures/books";
import { withReleaseDate } from "../../../domain/media/draft";
import {
  draftFromBook,
  emptyBookDraft,
  isDraftDirty,
  isDraftValid,
  toCreateRequest,
  toUpdateRequest,
} from "./bookDraft";

const book: BookResponse = { ...dune, description: "Desert planet." };

describe("bookDraft", () => {
  it("round-trips a book and knows when nothing changed", () => {
    const draft = draftFromBook(book);
    expect(isDraftValid(draft)).toBe(true);
    expect(isDraftDirty(book, draft)).toBe(false);
    expect(toUpdateRequest(book, draft, [herbert.id])).toEqual({});
  });

  it("does not require a type", () => {
    const draft = { ...draftFromBook(book), typeIds: [] };
    expect(isDraftValid(draft)).toBe(true);
    expect(toUpdateRequest(book, draft, [herbert.id])).toEqual({ typeIds: [] });
  });

  it("does not report a change when type ids are the same set in a different order", () => {
    const draft = { ...draftFromBook(book), typeIds: [kindle.id, hardcover.id] };
    expect(toUpdateRequest(book, draft, [herbert.id])).toEqual({});
  });

  it("sends only the changed fields and null to clear the cover and description", () => {
    const draft = { ...draftFromBook(book), title: "  Dune Messiah ", coverImageUrl: "", description: "  " };
    expect(isDraftDirty(book, draft)).toBe(true);
    expect(toUpdateRequest(book, draft, [herbert.id])).toEqual({
      title: "Dune Messiah",
      coverImageUrl: null,
      description: null,
    });
  });

  it("sends changed ownership, progress and types", () => {
    const draft = {
      ...draftFromBook(book),
      ownership: "watchlist" as const,
      progress: "finished" as const,
      typeIds: [paperback.id],
    };
    expect(toUpdateRequest(book, draft, [herbert.id])).toEqual({
      ownership: "watchlist",
      progress: "finished",
      typeIds: [paperback.id],
    });
  });

  it("sends the changed release date and null to clear it", () => {
    const dated = { ...book, releaseDate: "1965-08-01" };
    const draft = withReleaseDate(draftFromBook(dated), "1966-01-01");
    expect(toUpdateRequest(dated, draft, [herbert.id])).toEqual({ releaseDate: "1966-01-01", releaseYear: 1966 });
    expect(toUpdateRequest(dated, withReleaseDate(draftFromBook(dated), null), [herbert.id])).toEqual({
      releaseDate: null,
    });
  });

  it("builds a create request with a trimmed title and null for no cover/description", () => {
    const empty = emptyBookDraft();
    expect(isDraftValid(empty)).toBe(false);
    expect(() => toCreateRequest(empty, [])).toThrow();

    const draft = { ...emptyBookDraft(), title: " Emma ", releaseYear: 1815, description: " ", coverImageUrl: " " };
    expect(toCreateRequest(draft, [])).toEqual({
      title: "Emma",
      releaseYear: 1815,
      releaseDate: null,
      description: null,
      coverImageUrl: null,
      ownership: "watchlist",
      progress: "not_started",
    });
  });

  it("includes typeIds and authorIds in a create request only when non-empty", () => {
    const draft = { ...draftFromBook(book), typeIds: [hardcover.id] };
    expect(toCreateRequest(draft, [herbert.id])).toMatchObject({ typeIds: [hardcover.id], authorIds: [herbert.id] });
    expect(toCreateRequest({ ...draft, typeIds: [] }, [])).not.toHaveProperty("typeIds");
    expect(toCreateRequest({ ...draft, typeIds: [] }, [])).not.toHaveProperty("authorIds");
  });

  it("defaults ownership and progress on an empty draft", () => {
    const empty = emptyBookDraft();
    expect(empty.ownership).toBe("watchlist");
    expect(empty.progress).toBe("not_started");
    expect(empty.typeIds).toEqual([]);
    expect(empty.authors).toEqual([]);
  });
});

describe("bookDraft authors", () => {
  it("carries a book's authors into the draft", () => {
    expect(draftFromBook({ ...book, authors: [herbert, leGuin] }).authors).toEqual([herbert, leGuin]);
  });

  it("sends authorIds only when the resolved set differs from the book's, order-insensitive", () => {
    const two = { ...book, authors: [herbert, leGuin] };
    const draft = draftFromBook(two);
    expect(toUpdateRequest(two, draft, [leGuin.id, herbert.id])).toEqual({});
    expect(toUpdateRequest(two, draft, [herbert.id])).toEqual({ authorIds: [herbert.id] });
  });

  it("is dirty when a pending author is present, even before it resolves to an id", () => {
    expect(isDraftDirty(book, { ...draftFromBook(book), authors: [{ name: "New Author" }] })).toBe(true);
  });

  it("is dirty when the existing author selection differs, not when it is unchanged", () => {
    expect(isDraftDirty(book, { ...draftFromBook(book), authors: [leGuin] })).toBe(true);
    expect(isDraftDirty(book, draftFromBook(book))).toBe(false);
  });
});
