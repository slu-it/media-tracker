import { describe, expect, it } from "vitest";
import { dune, duneSaga, herbert, hardcover, simonVance } from "../../../test/fixtures/books";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import type { PageResponse, BookResponse } from "../../../types/api";
import { EMPTY_BOOK_FILTERS, type BookFilters } from "../domain/bookFilters";
import { AUTHOR_SEARCH_LIMIT, NARRATOR_SEARCH_LIMIT, SERIES_SEARCH_LIMIT } from "../domain/bookValues";
import {
  createBook,
  createBookAuthor,
  createBookNarrator,
  createBookSeries,
  deleteBook,
  getBookCoverOptions,
  getBookTitleSuggestions,
  getBooksMeta,
  listAuthorBooks,
  listBookAuthorSummaries,
  listBookSeriesSummaries,
  listBookTypes,
  listBooks,
  resolveAuthorIds,
  resolveNarratorIds,
  listSeriesBooks,
  resolveSeries,
  searchBookAuthors,
  searchBookNarrators,
  searchBookSeries,
  updateBook,
} from "./booksApi";

const page: PageResponse<BookResponse> = { items: [dune], page: 1, pageSize: 36, totalItems: 1, totalPages: 1 };

describe("booksApi", () => {
  it("lists the series summaries", async () => {
    const summaries = [{ id: "series-1", name: "Mistborn", bookCount: 3 }];
    const calls = mockApi({ "GET /api/book-series.summaries": () => jsonResponse(summaries) });
    expect(await listBookSeriesSummaries()).toEqual(summaries);
    expect(calls[0].url).toBe("/api/book-series.summaries");
  });

  it("lists the author summaries", async () => {
    const summaries = [{ id: "author-1", name: "Frank Herbert", bookCount: 2 }];
    const calls = mockApi({ "GET /api/book-authors.summaries": () => jsonResponse(summaries) });
    expect(await listBookAuthorSummaries()).toEqual(summaries);
    expect(calls[0].url).toBe("/api/book-authors.summaries");
  });

  it("lists the books of an author", async () => {
    const calls = mockApi({ "GET /api/book-authors/:id/books": () => jsonResponse([dune]) });
    expect(await listAuthorBooks("author/1")).toEqual([dune]);
    expect(calls[0].url).toBe("/api/book-authors/author%2F1/books");
  });

  it("lists the books of a series", async () => {
    const calls = mockApi({ "GET /api/book-series/:id/books": () => jsonResponse([dune]) });
    expect(await listSeriesBooks("series-1")).toEqual([dune]);
    expect(calls[0].url).toBe("/api/book-series/series-1/books");
  });

  it("lists with only page and pageSize for empty search and filters", async () => {
    const calls = mockApi({ "GET /api/books": () => jsonResponse(page) });
    expect(await listBooks(1, 36, "  ", EMPTY_BOOK_FILTERS)).toEqual(page);
    expect(calls[0].url).toBe("/api/books?page=1&pageSize=36");
  });

  it('omits the sort param for the default (undefined or "title") and sends any other', async () => {
    const calls = mockApi({ "GET /api/books": () => jsonResponse(page) });
    await listBooks(1, 36, "", EMPTY_BOOK_FILTERS, undefined);
    await listBooks(1, 36, "", EMPTY_BOOK_FILTERS, "title");
    await listBooks(1, 36, "", EMPTY_BOOK_FILTERS, "release_desc");
    expect(calls.map((c) => c.url)).toEqual([
      "/api/books?page=1&pageSize=36",
      "/api/books?page=1&pageSize=36",
      "/api/books?page=1&pageSize=36&sort=release_desc",
    ]);
  });

  it("sends the trimmed search and every filter value", async () => {
    const calls = mockApi({ "GET /api/books": () => jsonResponse(page) });
    const filters: BookFilters = {
      typeIds: [hardcover.id],
      ownership: ["owned"],
      progress: ["reading", "paused"],
      releaseYears: [1965],
    };
    await listBooks(2, 36, " dune ", filters);
    expect(calls[0].url).toBe(
      `/api/books?page=2&pageSize=36&search=dune&typeIds=${hardcover.id}&ownership=owned&progress=reading&progress=paused&releaseYear=1965`,
    );
  });

  it("calls the meta and type endpoints", async () => {
    const calls = mockApi({
      "GET /api/books.meta": () => jsonResponse({ types: [], ownership: [], progress: [], releaseYears: [] }),
      "GET /api/book-types": () => jsonResponse([hardcover]),
    });
    await getBooksMeta();
    expect(await listBookTypes()).toEqual([hardcover]);
    expect(calls.map((call) => call.url)).toEqual(["/api/books.meta", "/api/book-types"]);
  });

  it("creates, updates and deletes a book", async () => {
    const calls = mockApi({
      "POST /api/books": () => jsonResponse(dune, 201),
      "PATCH /api/books/book-1": () => jsonResponse(dune),
      "DELETE /api/books/book-1": () => new Response(null, { status: 204 }),
    });
    await createBook({ title: "Dune", releaseYear: 1965 });
    await updateBook("book-1", { title: "Dune 2" });
    await deleteBook("book-1");
    expect(calls[0].body).toEqual({ title: "Dune", releaseYear: 1965 });
    expect(calls[1].body).toEqual({ title: "Dune 2" });
    expect(calls).toHaveLength(3);
  });

  it("searches authors with the trimmed term and the limit", async () => {
    const calls = mockApi({ "GET /api/book-authors": () => jsonResponse([herbert]) });
    expect(await searchBookAuthors(" frank ")).toEqual([herbert]);
    expect(calls[0].url).toBe(`/api/book-authors?search=frank&limit=${AUTHOR_SEARCH_LIMIT}`);
  });

  it("creates an author and resolves drafts to ids, creating only pending names", async () => {
    const calls = mockApi({
      "POST /api/book-authors": () => jsonResponse({ id: "author-9", name: "New" }, 201),
    });
    expect(await createBookAuthor("New")).toEqual({ id: "author-9", name: "New" });
    expect(await resolveAuthorIds([herbert, { name: "New" }])).toEqual([herbert.id, "author-9"]);
    expect(calls).toHaveLength(2);
  });

  it("searches, creates and resolves narrators", async () => {
    const calls = mockApi({
      "GET /api/book-narrators": () => jsonResponse([simonVance]),
      "POST /api/book-narrators": () => jsonResponse({ id: "narrator-9", name: "New" }, 201),
    });
    expect(await searchBookNarrators(" simon ")).toEqual([simonVance]);
    expect(calls[0].url).toBe(`/api/book-narrators?search=simon&limit=${NARRATOR_SEARCH_LIMIT}`);
    expect(await createBookNarrator("New")).toEqual({ id: "narrator-9", name: "New" });
    expect(await resolveNarratorIds([simonVance, { name: "New" }])).toEqual([simonVance.id, "narrator-9"]);
  });

  it("searches and creates series", async () => {
    const calls = mockApi({
      "GET /api/book-series": () => jsonResponse([duneSaga]),
      "POST /api/book-series": () => jsonResponse({ id: "series-9", name: "New" }, 201),
    });
    expect(await searchBookSeries(" dune ")).toEqual([duneSaga]);
    expect(calls[0].url).toBe(`/api/book-series?search=dune&limit=${SERIES_SEARCH_LIMIT}`);
    expect(await createBookSeries("New")).toEqual({ id: "series-9", name: "New" });
    expect(calls[1].body).toEqual({ name: "New" });
  });

  it("resolves series drafts to links, keeping each position aligned with its series", async () => {
    const calls = mockApi({
      "POST /api/book-series": () => jsonResponse({ id: "series-9", name: "New" }, 201),
    });
    const links = await resolveSeries([
      { entry: { name: "New" }, position: "2,5" },
      { entry: duneSaga, position: "" },
      { entry: { name: " new " }, position: "7" },
    ]);
    expect(links).toEqual([
      { seriesId: "series-9", position: 2.5 },
      { seriesId: duneSaga.id, position: null },
    ]);
    expect(calls).toHaveLength(1);
  });

  it("prefers the first duplicate series link that has a position", async () => {
    mockApi({});
    const links = await resolveSeries([
      { entry: duneSaga, position: "" },
      { entry: duneSaga, position: "3" },
      { entry: duneSaga, position: "4" },
    ]);
    expect(links).toEqual([{ seriesId: duneSaga.id, position: 3 }]);
  });
});

describe("booksApi cover options and title suggestions", () => {
  it("requests cover options with only the query by default", async () => {
    const calls = mockApi({ "GET /api/books/cover-options": () => jsonResponse({}) });
    await getBookCoverOptions({ query: "  Dune ", releaseYear: null, source: "book" });
    expect(calls[0].url).toBe("/api/books/cover-options?query=Dune");
  });

  it("appends release year, match, audiobook source and page", async () => {
    const calls = mockApi({ "GET /api/books/cover-options": () => jsonResponse({}) });
    await getBookCoverOptions({ query: "Dune", releaseYear: 1965, match: "OL1W", source: "audiobook", page: 2 });
    expect(calls[0].url).toBe(
      "/api/books/cover-options?query=Dune&releaseYear=1965&match=OL1W&source=audiobook&page=2",
    );
  });

  it("requests title suggestions, sending the source only for audiobooks", async () => {
    const calls = mockApi({ "GET /api/books/title-suggestions": () => jsonResponse({ suggestions: [] }) });
    await getBookTitleSuggestions(" Dune", "book");
    await getBookTitleSuggestions("Dune", "audiobook");
    expect(calls[0].url).toBe("/api/books/title-suggestions?query=Dune");
    expect(calls[1].url).toBe("/api/books/title-suggestions?query=Dune&source=audiobook");
  });
});
