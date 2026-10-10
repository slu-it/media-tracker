import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useNavigate } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { BookResponse } from "../../types/api";
import { jsonResponse, mockApi, noContent, noTitleSuggestions } from "../../test/mockFetch";
import { bookTypes, dune, earthsea, hardcover, meta, mistbornBooks } from "../../test/fixtures/books";
import { currentLocation } from "../../test/currentLocation";
import { flushAsync } from "../../test/flushAsync";
import { HistoryControls } from "../../test/HistoryControls";
import { renderWithProviders } from "../../test/renderWithProviders";
import { BOOKS_PAGE_SIZE } from "./domain/bookValues";
import { BooksView } from "./BooksView";

const books: BookResponse[] = [dune, earthsea];

function pageOf(items: BookResponse[], page: number, totalItems: number) {
  return {
    items,
    page,
    pageSize: BOOKS_PAGE_SIZE,
    totalItems,
    totalPages: Math.ceil(totalItems / BOOKS_PAGE_SIZE),
  };
}

const mockTypes = () => jsonResponse(bookTypes);
const mockMeta = () => jsonResponse(meta);

/** URLs of `GET /api/books` requests, in order. */
function booksUrls(calls: { url: string }[]) {
  return calls.map((c) => c.url).filter((url) => url.startsWith("/api/books?"));
}

/**
 * Filters the fixture books by the `search` query param, like the real backend would. Without a search term
 * this only "browses" Dune, so a later match for another title proves the search request actually happened.
 */
function searchAwareBooks(_call: unknown, url: URL) {
  const page = Number(url.searchParams.get("page"));
  const search = (url.searchParams.get("search") ?? "").toLowerCase();
  if (search.length === 0) return jsonResponse(pageOf([dune], page, 1));
  const matches = books.filter((b) => b.title.toLowerCase().includes(search));
  return jsonResponse(pageOf(matches, page, matches.length));
}

const twoPages = (_call: unknown, url: URL) => {
  const page = Number(url.searchParams.get("page"));
  return jsonResponse(pageOf(page === 1 ? books : [books[1]], page, BOOKS_PAGE_SIZE + 1));
};

/** The results row is visually hidden (absolutely positioned 1px box) at a count of 0; jsdom's `toBeVisible` can't see that. */
function isResultsRowHidden() {
  // eslint-disable-next-line testing-library/no-node-access -- the row has no role; status sits in the left wrapper in the row
  const row = screen.getByRole("status").parentElement!.parentElement!;
  const style = getComputedStyle(row);
  return style.position === "absolute" && style.width === "1px";
}

const waitForTypeSelect = () =>
  waitFor(() => expect(screen.getByRole("combobox", { name: "Type" })).not.toHaveAttribute("aria-disabled"));

/** A link-like external navigation: pushes `to` onto the history. */
function GoTo({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button onClick={() => void navigate(to)}>Go to {to}</button>;
}

describe("BooksView", () => {
  it("shows the series chip on a grid card", async () => {
    mockApi({
      "GET /api/books": () => jsonResponse(pageOf([mistbornBooks[0]], 1, 1)),
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("heading", { name: "The Final Empire" })).toBeInTheDocument();
    expect(screen.getByText("Mistborn #1")).toBeInTheDocument();
  });

  it("renders the grid and opens the detail dialog from a card", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/books": () => jsonResponse(pageOf(books, 1, 2)),
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />);

    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A Wizard of Earthsea" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 books");

    await user.click(screen.getByRole("button", { name: /Earthsea/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "A Wizard of Earthsea" })).toBeInTheDocument();
    expect(within(dialog).getByText("Ursula K. Le Guin")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("requests the next page from the pagination control", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/books": twoPages,
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: "A Wizard of Earthsea" })).toBeInTheDocument();
    expect(booksUrls(calls)).toEqual([
      `/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}`,
      `/api/books?page=2&pageSize=${BOOKS_PAGE_SIZE}`,
    ]);
  });

  it("shows the empty state and opens the add dialog from the FAB", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/books": () => jsonResponse(pageOf([], 1, 0)),
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />, { realStyles: true });
    expect(await screen.findByText(/No books yet/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 books");
    expect(isResultsRowHidden()).toBe(true);

    await waitFor(() => expect(screen.getByRole("button", { name: "Add book" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Add book" }));
    const dialog = await screen.findByRole("dialog", { name: "Add book" });
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("shows an error with a retry button when loading fails", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      "GET /api/books": () =>
        fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(pageOf(books, 1, 2)),
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();
  });

  it("shows an error with a retry button when loading the types fails", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      "GET /api/books": () => jsonResponse(pageOf(books, 1, 2)),
      "GET /api/book-types": () => (fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(bookTypes)),
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    expect(screen.getByRole("button", { name: "Add book" })).toBeDisabled();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Add book" })).toBeEnabled();
  });

  it("shows an error with a retry button when loading the meta fails", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      "GET /api/books": () => jsonResponse(pageOf(books, 1, 2)),
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": () => (fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(meta)),
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    await waitForTypeSelect();
  });

  it("shows the previous page after deleting the last book of a later page", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/books": twoPages,
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
      "DELETE /api/books/:id": () => noContent(),
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: "A Wizard of Earthsea" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Earthsea/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "A Wizard of Earthsea"?');
    // Selects the last-mounted (topmost) portal: the confirm dialog stacked over the detail dialog.
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();
    expect(calls).toContainEqual({ method: "DELETE", url: "/api/books/book-2", body: undefined });
    const deleteIndex = calls.findIndex((c) => c.method === "DELETE");
    const afterDelete = calls.slice(deleteIndex + 1).filter((c) => c.url.startsWith("/api/books?"));
    expect(afterDelete.map((c) => c.url)).toEqual([`/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}`]);
  });

  it("reloads the current page after deleting a book that was not the last one", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/books": () => jsonResponse(pageOf(books, 1, 2)),
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
      "DELETE /api/books/:id": () => noContent(),
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Dune/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Dune"?');
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(booksUrls(calls)).toHaveLength(2));
    expect(booksUrls(calls)).toEqual([
      `/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}`,
      `/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}`,
    ]);
  });

  it("quick-patches the progress from the open dialog and reloads the list", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/books": () => jsonResponse(pageOf(books, 1, 2)),
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
      "PATCH /api/books/:id": (call) => jsonResponse({ ...dune, ...(call.body as object) }),
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Dune/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Finished" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Finished" })).toHaveAttribute("aria-pressed", "true"),
    );
    await waitFor(() => expect(booksUrls(calls)).toHaveLength(2));
    expect(calls.filter((c) => c.method === "PATCH")).toEqual([
      { method: "PATCH", url: "/api/books/book-1", body: { progress: "finished" } },
    ]);
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument(); // still in view mode
  });

  it("updates the open book and reloads the list after saving an edit", async () => {
    const user = userEvent.setup();
    let reloaded = false;
    const calls = mockApi({
      "GET /api/books": () => {
        const items = reloaded ? [{ ...dune, title: "Dune Messiah" }, earthsea] : books;
        reloaded = true;
        return jsonResponse(pageOf(items, 1, 2));
      },
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
      ...noTitleSuggestions("books"),
      "PATCH /api/books/:id": (call) => jsonResponse({ ...dune, ...(call.body as object) }),
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Dune/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.clear(title);
    await user.paste("Dune Messiah");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("heading", { name: "Dune Messiah" })).toBeInTheDocument();
    await waitFor(() => expect(booksUrls(calls)).toHaveLength(2));

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Dune Messiah" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dune" })).not.toBeInTheDocument();
  });

  it("closes the add dialog and reloads the list after creating a book", async () => {
    const user = userEvent.setup();
    let reloaded = false;
    const calls = mockApi({
      "GET /api/books": () => {
        const items = reloaded ? [...books, { ...earthsea, id: "book-3", title: "Neuromancer" }] : books;
        const totalItems = reloaded ? 3 : 2;
        reloaded = true;
        return jsonResponse(pageOf(items, 1, totalItems));
      },
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
      ...noTitleSuggestions("books"),
      "POST /api/books": (call) => jsonResponse({ id: "book-3", ...(call.body as object) }, 201),
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: "Add book" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Add book" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: /title/i }));
    await user.paste("Neuromancer");
    await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "1984" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === "POST" && c.url === "/api/books")).toBe(true);
    expect(booksUrls(calls)).toHaveLength(2);
    expect(await screen.findByRole("heading", { name: "Neuromancer" })).toBeInTheDocument();
  });

  it("sends one request with the search term after the debounce and shows the matches", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/books": searchAwareBooks,
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />, { searchDebounceMs: 300 });
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search books" }));
    await user.paste("earthsea");
    expect(booksUrls(calls)).toEqual([`/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}`]);

    expect(await screen.findByRole("heading", { name: "A Wizard of Earthsea" })).toBeInTheDocument();
    expect(booksUrls(calls)).toEqual([
      `/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}`,
      `/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}&search=earthsea`,
    ]);
  });

  it("clears the search immediately with the clear button and drops the search and page params", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/books": (_call, url) => {
        const page = Number(url.searchParams.get("page"));
        if (url.searchParams.has("search")) return jsonResponse(pageOf([earthsea], page, BOOKS_PAGE_SIZE + 1));
        return jsonResponse(pageOf([dune], page, 1));
      },
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    // A debounce far beyond the waitFor timeout below: only an explicit flush can get Dune on screen.
    renderWithProviders(<BooksView />, { route: "/?search=earthsea&page=2", searchDebounceMs: 5000 });
    expect(await screen.findByRole("heading", { name: "A Wizard of Earthsea" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByRole("heading", { name: "Dune" }, { timeout: 500 })).toBeInTheDocument();
    expect(booksUrls(calls)).toEqual([
      `/api/books?page=2&pageSize=${BOOKS_PAGE_SIZE}&search=earthsea`,
      `/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}`,
    ]);
    expect(currentLocation()).not.toContain("search=");
    expect(currentLocation()).not.toContain("page=");
  });

  it("searches immediately on Enter", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/books": searchAwareBooks,
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />, { searchDebounceMs: 5000 });
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search books" }));
    await user.paste("earthsea");
    await user.keyboard("{Enter}");

    await waitFor(
      () => expect(booksUrls(calls)).toContain(`/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}&search=earthsea`),
      { timeout: 500 },
    );
  });

  it("shows the search-specific empty state when nothing matches", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/books": searchAwareBooks,
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search books" }));
    await user.paste("zzz");

    expect(await screen.findByText('No books match "zzz"')).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search books" })).toHaveValue("zzz");
  });

  it("hides the results row for a search without matches and without status filters", async () => {
    mockApi({
      "GET /api/books": () => jsonResponse(pageOf([], 1, 0)),
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />, { route: "/books/overview?search=zzz", realStyles: true });

    expect(await screen.findByText('No books match "zzz"')).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 books");
    expect(isResultsRowHidden()).toBe(true);
  });

  it("adds the selected type as a repeated parameter and reloads without it once cleared", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/books": () => jsonResponse(pageOf(books, 1, 2)),
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await waitForTypeSelect();
    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.click(screen.getByRole("option", { name: "Hardcover" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(booksUrls(calls)).toContain(`/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}&typeIds=${hardcover.id}`),
    );

    await user.click(screen.getByRole("button", { name: "Clear Type" }));
    await flushAsync();
    expect(screen.getByRole("combobox", { name: "Type" })).toHaveTextContent("-all-");
    await waitFor(() => expect(booksUrls(calls).at(-1)).toBe(`/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}`));
  });

  it("sends the release year filter", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/books": () => jsonResponse(pageOf(books, 1, 2)),
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Release year" })).not.toHaveAttribute("aria-disabled"),
    );
    await user.click(screen.getByRole("combobox", { name: "Release year" }));
    await user.click(screen.getByRole("option", { name: "1965" }));
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(booksUrls(calls)).toContain(`/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}&releaseYear=1965`),
    );
  });

  it("returns to page 1 when a filter changes on a later page", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/books": twoPages,
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />);
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: "A Wizard of Earthsea" })).toBeInTheDocument();

    await waitForTypeSelect();
    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.click(screen.getByRole("option", { name: "Hardcover" }));

    await waitFor(() =>
      expect(booksUrls(calls)).toEqual([
        `/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}`,
        `/api/books?page=2&pageSize=${BOOKS_PAGE_SIZE}`,
        `/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}&typeIds=${hardcover.id}`,
      ]),
    );
  });

  it("shows the filter-specific empty state and keeps the toggles when they lead to zero results", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/books": (_call, url) =>
        url.searchParams.has("progress") ? jsonResponse(pageOf([], 1, 0)) : jsonResponse(pageOf(books, 1, 2)),
      "GET /api/book-types": mockTypes,
      "GET /api/books.meta": mockMeta,
    });
    renderWithProviders(<BooksView />, { realStyles: true });
    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reading" }));

    expect(await screen.findByText("No books match the selected filters.")).toBeInTheDocument();
    expect(screen.queryByText(/No books yet/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 books");
    expect(isResultsRowHidden()).toBe(false);
    expect(screen.getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Reading" }));

    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 books");
  });

  describe("URL state", () => {
    const OVERVIEW_PATH = "/books/overview";

    it("loads the state of a deep link and shows the filters as selected", async () => {
      const calls = mockApi({
        "GET /api/books": twoPages,
        "GET /api/book-types": mockTypes,
        "GET /api/books.meta": mockMeta,
      });
      renderWithProviders(<BooksView />, {
        route: `${OVERVIEW_PATH}?search=dune&type=${hardcover.id}&ownership=owned&progress=reading&year=1965&page=2`,
      });

      expect(await screen.findByRole("heading", { name: "A Wizard of Earthsea" })).toBeInTheDocument();
      expect(booksUrls(calls)).toHaveLength(1);
      const query = new URL(booksUrls(calls)[0], "http://localhost").searchParams;
      expect(Object.fromEntries(query)).toEqual({
        page: "2",
        pageSize: String(BOOKS_PAGE_SIZE),
        search: "dune",
        typeIds: hardcover.id,
        ownership: "owned",
        progress: "reading",
        releaseYear: "1965",
      });
      expect(screen.getByRole("searchbox", { name: "Search books" })).toHaveValue("dune");
      await waitFor(() => expect(screen.getByRole("combobox", { name: "Type" })).toHaveTextContent("Hardcover"));
      expect(screen.getByRole("button", { name: "Owned" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Watchlist" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Finished" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("combobox", { name: "Release year" })).toHaveTextContent("1965");
    });

    it("filters by toggles, replacing the URL and dropping the page", async () => {
      const user = userEvent.setup();
      const calls = mockApi({
        "GET /api/books": twoPages,
        "GET /api/book-types": mockTypes,
        "GET /api/books.meta": mockMeta,
      });
      renderWithProviders(
        <>
          <BooksView />
          <HistoryControls />
          <GoTo to={`${OVERVIEW_PATH}?page=2`} />
        </>,
        { route: OVERVIEW_PATH },
      );
      await screen.findByRole("heading", { name: "Dune" });
      await user.click(screen.getByRole("button", { name: /^Go to \/books/ }));
      expect(await screen.findByRole("heading", { name: "A Wizard of Earthsea" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Reading" }));
      await user.click(screen.getByRole("button", { name: "Owned" }));
      await waitFor(() =>
        expect(booksUrls(calls).at(-1)).toBe(
          `/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}&ownership=owned&progress=reading`,
        ),
      );
      expect(currentLocation()).toBe(`${OVERVIEW_PATH}?ownership=owned&progress=reading`);

      // Replaced, not pushed: Back skips straight to the entry before the page-2 one.
      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();
      expect(currentLocation()).toBe(OVERVIEW_PATH);
    });

    it("replaces the URL with the debounced search and drops the page", async () => {
      const user = userEvent.setup();
      mockApi({
        "GET /api/books": twoPages,
        "GET /api/book-types": mockTypes,
        "GET /api/books.meta": mockMeta,
      });
      renderWithProviders(
        <>
          <BooksView />
          <HistoryControls />
          <GoTo to={`${OVERVIEW_PATH}?page=2`} />
        </>,
        { route: OVERVIEW_PATH, searchDebounceMs: 300 },
      );
      await screen.findByRole("heading", { name: "Dune" });
      await user.click(screen.getByRole("button", { name: /^Go to \/books/ }));
      await screen.findByRole("heading", { name: "A Wizard of Earthsea" });

      await user.click(screen.getByRole("searchbox", { name: "Search books" }));
      await user.paste("earthsea");
      // Positive control: the URL is untouched while the debounce is pending, and changes once it has passed.
      expect(currentLocation()).toBe(`${OVERVIEW_PATH}?page=2`);
      await waitFor(() => expect(currentLocation()).toBe(`${OVERVIEW_PATH}?search=earthsea`));

      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();
      expect(currentLocation()).toBe(OVERVIEW_PATH);
    });

    it("updates the URL and drops the page when a type filter changes", async () => {
      const user = userEvent.setup();
      mockApi({
        "GET /api/books": twoPages,
        "GET /api/book-types": mockTypes,
        "GET /api/books.meta": mockMeta,
      });
      renderWithProviders(<BooksView />, { route: `${OVERVIEW_PATH}?page=2` });
      await screen.findByRole("heading", { name: "A Wizard of Earthsea" });

      await waitForTypeSelect();
      await user.click(screen.getByRole("combobox", { name: "Type" }));
      await user.click(screen.getByRole("option", { name: "Hardcover" }));

      await waitFor(() => expect(currentLocation()).toBe(`${OVERVIEW_PATH}?type=${hardcover.id}`));
    });

    it("pushes a history entry on a page change and Back returns to the previous page", async () => {
      const user = userEvent.setup();
      const scrollTo = vi.spyOn(window, "scrollTo");
      const calls = mockApi({
        "GET /api/books": twoPages,
        "GET /api/book-types": mockTypes,
        "GET /api/books.meta": mockMeta,
      });
      renderWithProviders(
        <>
          <BooksView />
          <HistoryControls />
        </>,
        { route: OVERVIEW_PATH },
      );
      await screen.findByRole("heading", { name: "Dune" });

      await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
      expect(await screen.findByRole("heading", { name: "A Wizard of Earthsea" })).toBeInTheDocument();
      expect(currentLocation()).toBe(`${OVERVIEW_PATH}?page=2`);
      expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0 });
      scrollTo.mockClear();

      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();
      expect(currentLocation()).toBe(OVERVIEW_PATH);
      expect(booksUrls(calls).at(-1)).toBe(`/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}`);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("ignores junk params", async () => {
      const calls = mockApi({
        "GET /api/books": () => jsonResponse(pageOf(books, 1, 2)),
        "GET /api/book-types": mockTypes,
        "GET /api/books.meta": mockMeta,
      });
      renderWithProviders(<BooksView />, { route: `${OVERVIEW_PATH}?page=-3&ownership=foo&year=abc` });
      expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();
      expect(booksUrls(calls)).toEqual([`/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}`]);
    });
  });
});
