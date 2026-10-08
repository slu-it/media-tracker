import { describe, expect, it } from "vitest";
import type { BookResponse, BookSeriesLinkRequest } from "../../../types/api";
import {
  dune,
  duneSaga,
  herbert,
  hardcover,
  kindle,
  leGuin,
  mistborn,
  paperback,
  simonVance,
} from "../../../test/fixtures/books";
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

/** Resolved links equal to `book`'s (authors: Herbert), overridable per test. */
function links(over: { authorIds?: string[]; narratorIds?: string[]; series?: BookSeriesLinkRequest[] } = {}): {
  authorIds: string[];
  narratorIds: string[];
  series: BookSeriesLinkRequest[];
} {
  return { authorIds: [herbert.id], narratorIds: [], series: [], ...over };
}

describe("bookDraft", () => {
  it("round-trips a book and knows when nothing changed", () => {
    const draft = draftFromBook(book, "en");
    expect(isDraftValid(draft)).toBe(true);
    expect(isDraftDirty(book, draft)).toBe(false);
    expect(toUpdateRequest(book, draft, links())).toEqual({});
  });

  it("does not require a type", () => {
    const draft = { ...draftFromBook(book, "en"), typeIds: [] };
    expect(isDraftValid(draft)).toBe(true);
    expect(toUpdateRequest(book, draft, links())).toEqual({ typeIds: [] });
  });

  it("does not report a change when type ids are the same set in a different order", () => {
    const draft = { ...draftFromBook(book, "en"), typeIds: [kindle.id, hardcover.id] };
    expect(toUpdateRequest(book, draft, links())).toEqual({});
  });

  it("sends only the changed fields and null to clear the cover and description", () => {
    const draft = { ...draftFromBook(book, "en"), title: "  Dune Messiah ", coverImageUrl: "", description: "  " };
    expect(isDraftDirty(book, draft)).toBe(true);
    expect(toUpdateRequest(book, draft, links())).toEqual({
      title: "Dune Messiah",
      coverImageUrl: null,
      description: null,
    });
  });

  it("sends changed ownership, progress and types", () => {
    const draft = {
      ...draftFromBook(book, "en"),
      ownership: "watchlist" as const,
      progress: "finished" as const,
      typeIds: [paperback.id],
    };
    expect(toUpdateRequest(book, draft, links())).toEqual({
      ownership: "watchlist",
      progress: "finished",
      typeIds: [paperback.id],
    });
  });

  it("sends the changed release date and null to clear it", () => {
    const dated = { ...book, releaseDate: "1965-08-01" };
    const draft = withReleaseDate(draftFromBook(dated, "en"), "1966-01-01");
    expect(toUpdateRequest(dated, draft, links())).toEqual({ releaseDate: "1966-01-01", releaseYear: 1966 });
    expect(toUpdateRequest(dated, withReleaseDate(draftFromBook(dated, "en"), null), links())).toEqual({
      releaseDate: null,
    });
  });

  it("builds a create request with a trimmed title and null for no cover/description", () => {
    const empty = emptyBookDraft();
    expect(isDraftValid(empty)).toBe(false);
    expect(() => toCreateRequest(empty, links({ authorIds: [] }))).toThrow();

    const draft = { ...emptyBookDraft(), title: " Emma ", releaseYear: 1815, description: " ", coverImageUrl: " " };
    expect(toCreateRequest(draft, links({ authorIds: [] }))).toEqual({
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
    const draft = { ...draftFromBook(book, "en"), typeIds: [hardcover.id] };
    expect(toCreateRequest(draft, links())).toMatchObject({ typeIds: [hardcover.id], authorIds: [herbert.id] });
    expect(toCreateRequest({ ...draft, typeIds: [] }, links({ authorIds: [] }))).not.toHaveProperty("typeIds");
    expect(toCreateRequest({ ...draft, typeIds: [] }, links({ authorIds: [] }))).not.toHaveProperty("authorIds");
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
    expect(draftFromBook({ ...book, authors: [herbert, leGuin] }, "en").authors).toEqual([herbert, leGuin]);
  });

  it("sends authorIds only when the resolved set differs from the book's, order-insensitive", () => {
    const two = { ...book, authors: [herbert, leGuin] };
    const draft = draftFromBook(two, "en");
    expect(toUpdateRequest(two, draft, links({ authorIds: [leGuin.id, herbert.id] }))).toEqual({});
    expect(toUpdateRequest(two, draft, links())).toEqual({ authorIds: [herbert.id] });
  });

  it("is dirty when a pending author is present, even before it resolves to an id", () => {
    expect(isDraftDirty(book, { ...draftFromBook(book, "en"), authors: [{ name: "New Author" }] })).toBe(true);
  });

  it("is dirty when the existing author selection differs, not when it is unchanged", () => {
    expect(isDraftDirty(book, { ...draftFromBook(book, "en"), authors: [leGuin] })).toBe(true);
    expect(isDraftDirty(book, draftFromBook(book, "en"))).toBe(false);
  });
});

describe("bookDraft narrators", () => {
  const narrated = { ...book, narrators: [simonVance] };

  it("carries a book's narrators into the draft", () => {
    expect(draftFromBook(narrated, "en").narrators).toEqual([simonVance]);
    expect(emptyBookDraft().narrators).toEqual([]);
  });

  it("sends narratorIds only when the set differs, and in a create request only when non-empty", () => {
    const draft = draftFromBook(narrated, "en");
    expect(toUpdateRequest(narrated, draft, links({ narratorIds: [simonVance.id] }))).toEqual({});
    expect(toUpdateRequest(narrated, draft, links())).toEqual({ narratorIds: [] });
    expect(toCreateRequest(draft, links({ narratorIds: [simonVance.id] }))).toMatchObject({
      narratorIds: [simonVance.id],
    });
    expect(toCreateRequest(draft, links())).not.toHaveProperty("narratorIds");
  });

  it("is dirty for a pending narrator", () => {
    expect(isDraftDirty(book, { ...draftFromBook(book, "en"), narrators: [{ name: "New" }] })).toBe(true);
    expect(isDraftDirty(narrated, draftFromBook(narrated, "en"))).toBe(false);
  });
});

describe("bookDraft series", () => {
  const inSeries: BookResponse = {
    ...book,
    series: [
      { id: duneSaga.id, name: duneSaga.name, position: 1 },
      { id: mistborn.id, name: mistborn.name, position: null },
    ],
  };

  it("formats existing positions into the draft", () => {
    expect(draftFromBook({ ...book, series: [{ id: "s", name: "S", position: 2.5 }] }, "en").series).toEqual([
      { entry: { id: "s", name: "S" }, position: "2.5" },
    ]);
    expect(draftFromBook(inSeries, "en").series.map((series) => series.position)).toEqual(["1", ""]);
    expect(draftFromBook({ ...book, series: [{ id: "s", name: "S", position: 2.5 }] }, "de").series[0].position).toBe(
      "2,5",
    );
    expect(emptyBookDraft().series).toEqual([]);
  });

  it("sends series only when the set of (id, position) pairs differs", () => {
    const draft = draftFromBook(inSeries, "en");
    const same = [
      { seriesId: mistborn.id, position: null },
      { seriesId: duneSaga.id, position: 1 },
    ];
    expect(toUpdateRequest(inSeries, draft, links({ series: same }))).toEqual({});
    const moved = [
      { seriesId: duneSaga.id, position: 2.5 },
      { seriesId: mistborn.id, position: null },
    ];
    expect(toUpdateRequest(inSeries, draft, links({ series: moved }))).toEqual({ series: moved });
    expect(toUpdateRequest(inSeries, draft, links())).toEqual({ series: [] });
  });

  it("is dirty for an edited position or a pending series, not for an unchanged one", () => {
    const draft = draftFromBook(inSeries, "en");
    expect(isDraftDirty(inSeries, draft)).toBe(false);
    expect(
      isDraftDirty(inSeries, { ...draft, series: [{ ...draft.series[0], position: "1,50" }, draft.series[1]] }),
    ).toBe(true);
    expect(
      isDraftDirty(inSeries, { ...draft, series: [...draft.series, { entry: { name: "New" }, position: "" }] }),
    ).toBe(true);
    expect(
      isDraftDirty(inSeries, { ...draft, series: [{ ...draft.series[0], position: "1.0" }, draft.series[1]] }),
    ).toBe(false);
  });

  it("is invalid while a position is invalid", () => {
    const draft = draftFromBook(inSeries, "en");
    expect(isDraftValid({ ...draft, series: [{ ...draft.series[0], position: "abc" }] })).toBe(false);
  });

  it("includes series in a create request only when non-empty", () => {
    const series = [{ seriesId: duneSaga.id, position: 1 }];
    expect(toCreateRequest(draftFromBook(inSeries, "en"), links({ series }))).toMatchObject({ series });
    expect(toCreateRequest(draftFromBook(inSeries, "en"), links())).not.toHaveProperty("series");
  });
});
