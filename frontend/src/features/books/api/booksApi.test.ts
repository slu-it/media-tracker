import { describe, expect, it } from "vitest";
import { dune, herbert, hardcover } from "../../../test/fixtures/books";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import type { PageResponse, BookResponse } from "../../../types/api";
import { EMPTY_BOOK_FILTERS, type BookFilters } from "../domain/bookFilters";
import { AUTHOR_SEARCH_LIMIT } from "../domain/bookValues";
import {
  createBook,
  createBookAuthor,
  deleteBook,
  getBooksMeta,
  listBookTypes,
  listBooks,
  resolveAuthorIds,
  searchBookAuthors,
  updateBook,
} from "./booksApi";

const page: PageResponse<BookResponse> = { items: [dune], page: 1, pageSize: 36, totalItems: 1, totalPages: 1 };

describe("booksApi", () => {
  it("lists with only page and pageSize for empty search and filters", async () => {
    const calls = mockApi({ "GET /api/books": () => jsonResponse(page) });
    expect(await listBooks(1, 36, "  ", EMPTY_BOOK_FILTERS)).toEqual(page);
    expect(calls[0].url).toBe("/api/books?page=1&pageSize=36");
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
});
