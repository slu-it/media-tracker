import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { currentLocation } from "../../test/currentLocation";
import { flushAsync } from "../../test/flushAsync";
import {
  authorSummaries,
  bookTypes,
  emptyAuthorSummary,
  herbert,
  herbertBooks,
  herbertSummary,
  meta,
} from "../../test/fixtures/books";
import { jsonResponse, mockApi, noContent } from "../../test/mockFetch";
import { renderWithProviders } from "../../test/renderWithProviders";
import { BookAuthorsView } from "./BookAuthorsView";

const SUMMARIES = "GET /api/book-authors.summaries";
const HERBERT_BOOKS = `GET /api/book-authors/${herbert.id}/books`;

const base = () => ({
  [SUMMARIES]: () => jsonResponse(authorSummaries),
  "GET /api/book-types": () => jsonResponse(bookTypes),
  "GET /api/books.meta": () => jsonResponse(meta),
});

const cardTitles = () => screen.getAllByRole("heading", { level: 3, hidden: true }).map((h) => h.textContent);

describe("BookAuthorsView", () => {
  it("lists every author with the count and loads no books", async () => {
    const calls = mockApi(base());
    renderWithProviders(<BookAuthorsView />);
    expect(await screen.findByRole("heading", { name: /^Frank Herbert/ })).toBeInTheDocument();
    const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(["Émile Zola0 books", "Frank Herbert2 books", "Ursula K. Le Guin1 book"]);
    expect(screen.getByRole("status")).toHaveTextContent("3 authors");
    expect(calls.some((c) => c.url.includes("book-authors/"))).toBe(false);
  });

  it("filters by search without any request", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<BookAuthorsView />);
    await screen.findByRole("heading", { name: /^Frank Herbert/ });
    const before = calls.length;

    await user.click(screen.getByRole("searchbox", { name: "Search authors" }));
    await user.paste("emile");
    await waitFor(() => expect(currentLocation()).toContain("search=emile"));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Émile Zola0 books"]);
    expect(screen.getByRole("status")).toHaveTextContent("1 author");

    await user.clear(screen.getByRole("searchbox", { name: "Search authors" }));
    await user.paste("nothing");
    expect(await screen.findByText('No authors match "nothing"')).toBeInTheDocument();
    expect(calls).toHaveLength(before);
  });

  it("shows the empty text without authors", async () => {
    mockApi({ ...base(), [SUMMARIES]: () => jsonResponse([]) });
    renderWithProviders(<BookAuthorsView />);
    expect(await screen.findByText("No authors yet. Add one while editing a book.")).toBeInTheDocument();
  });

  it("fetches the books only on expand and shows them in backend order without badges", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), [HERBERT_BOOKS]: () => jsonResponse(herbertBooks) });
    renderWithProviders(<BookAuthorsView />);
    await user.click(await screen.findByRole("button", { name: /Frank Herbert/ }));

    expect(await screen.findByRole("heading", { name: "Dune Messiah" })).toBeInTheDocument();
    expect(calls.filter((c) => c.url === `/api/book-authors/${herbert.id}/books`)).toHaveLength(1);
    expect(cardTitles()).toEqual(["Dune", "Dune Messiah"]);
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
  });

  it("shows a message for an author without books, without a request", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<BookAuthorsView />);
    await user.click(await screen.findByRole("button", { name: new RegExp(emptyAuthorSummary.name) }));
    expect(await screen.findByText("No books by this author")).toBeInTheDocument();
    expect(calls.some((c) => /book-authors\/.+\/books/.test(c.url))).toBe(false);
  });

  it("opens the detail dialog from a card", async () => {
    const user = userEvent.setup();
    mockApi({ ...base(), [HERBERT_BOOKS]: () => jsonResponse(herbertBooks) });
    renderWithProviders(<BookAuthorsView />);
    await user.click(await screen.findByRole("button", { name: /Frank Herbert/ }));
    await user.click(await screen.findByRole("button", { name: /Dune Messiah/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Dune Messiah" })).toBeInTheDocument();
  });

  it("reloads the summaries and the open section after a save", async () => {
    const user = userEvent.setup();
    let books = herbertBooks;
    const calls = mockApi({
      ...base(),
      [HERBERT_BOOKS]: () => jsonResponse(books),
      "PATCH /api/books/:id": (call) =>
        jsonResponse({ ...herbertBooks[1], title: "Renamed", ...(call.body as object) }),
    });
    renderWithProviders(<BookAuthorsView />);
    await user.click(await screen.findByRole("button", { name: /Frank Herbert/ }));
    await user.click(await screen.findByRole("button", { name: /Dune Messiah/ }));
    const dialog = await screen.findByRole("dialog");
    expect(cardTitles()).toEqual(["Dune", "Dune Messiah"]);
    books = [herbertBooks[1], herbertBooks[0]];
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.clear(title);
    await user.paste("Renamed");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await flushAsync();
    // The old cards stay visible while the section reloads.
    expect(screen.getAllByRole("heading", { level: 3, hidden: true }).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(calls.filter((c) => c.url === "/api/book-authors.summaries")).toHaveLength(2);
      expect(calls.filter((c) => c.url === `/api/book-authors/${herbert.id}/books`)).toHaveLength(2);
    });
    await waitFor(() => expect(cardTitles()).toEqual(["Dune Messiah", "Dune"]));
  });

  it("closes the dialog and reloads the summaries and the open section after a delete", async () => {
    const user = userEvent.setup();
    let books = herbertBooks;
    let summaries = authorSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      [HERBERT_BOOKS]: () => jsonResponse(books),
      "DELETE /api/books/:id": () => noContent(),
    });
    renderWithProviders(<BookAuthorsView />);
    await user.click(await screen.findByRole("button", { name: /Frank Herbert/ }));
    await user.click(await screen.findByRole("button", { name: /Dune Messiah/ }));
    const dialog = await screen.findByRole("dialog");
    books = herbertBooks.slice(0, 1);
    summaries = authorSummaries.map((s) => (s.id === herbert.id ? { ...s, bookCount: 1 } : s));
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Dune Messiah"?');
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContainEqual({ method: "DELETE", url: `/api/books/${herbertBooks[1].id}`, body: undefined });
    await waitFor(() => {
      expect(calls.filter((c) => c.url === "/api/book-authors.summaries")).toHaveLength(2);
      expect(calls.filter((c) => c.url === `/api/book-authors/${herbert.id}/books`)).toHaveLength(2);
    });
    expect(await screen.findByRole("heading", { name: /^Frank Herbert/ })).toHaveTextContent("Frank Herbert1 book");
    await waitFor(() => expect(cardTitles()).toEqual(["Dune"]));
  });

  it("shows an error with retry when the summaries fail", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      ...base(),
      [SUMMARIES]: () => (fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse([herbertSummary])),
    });
    renderWithProviders(<BookAuthorsView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: /^Frank Herbert/ })).toBeInTheDocument();
  });
});
