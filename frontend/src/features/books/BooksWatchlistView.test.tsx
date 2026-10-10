import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useNavigate } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { BookResponse } from "../../types/api";
import { jsonResponse, mockApi, noContent, noTitleSuggestions } from "../../test/mockFetch";
import { bookTypes, earthsea, hardcover, meta } from "../../test/fixtures/books";
import { currentLocation } from "../../test/currentLocation";
import { flushAsync } from "../../test/flushAsync";
import { HistoryControls } from "../../test/HistoryControls";
import { renderWithProviders } from "../../test/renderWithProviders";
import { BOOKS_PAGE_SIZE } from "./domain/bookValues";
import { DEFAULT_WATCHLIST_SORT } from "./domain/bookViewParams";
import { BooksWatchlistView } from "./BooksWatchlistView";

// Both watchlisted: `earthsea` (no exact release date) and `dated` (an exact release date).
const dated: BookResponse = {
  ...earthsea,
  id: "book-3",
  title: "The Left Hand of Darkness",
  releaseYear: 1969,
  releaseDate: "1969-03-01",
};
const books: BookResponse[] = [earthsea, dated];
const EARTHSEA = "A Wizard of Earthsea";
const DARKNESS = "The Left Hand of Darkness";
const BASE = `/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}&ownership=watchlist`;

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

const waitForTypeSelect = () =>
  waitFor(() => expect(screen.getByRole("combobox", { name: "Type" })).not.toHaveAttribute("aria-disabled"));

/** The results row is visually hidden (absolutely positioned 1px box) at a count of 0 without `facts`. */
function isResultsRowHidden() {
  // eslint-disable-next-line testing-library/no-node-access -- the row has no role; status sits in the left wrapper in the row
  const row = screen.getByRole("status").parentElement!.parentElement!;
  const style = getComputedStyle(row);
  return style.position === "absolute" && style.width === "1px";
}

const twoPages = (_call: unknown, url: URL) => {
  const page = Number(url.searchParams.get("page"));
  return jsonResponse(pageOf(page === 1 ? books : [dated], page, BOOKS_PAGE_SIZE + 1));
};

const baseMocks = (
  list: (call: unknown, url: URL) => Response | Promise<Response> = () => jsonResponse(pageOf(books, 1, 2)),
) => ({
  "GET /api/books": list,
  "GET /api/book-types": mockTypes,
  "GET /api/books.meta": mockMeta,
});

describe("BooksWatchlistView", () => {
  it("requests the watchlist with the default oldest-first sort and shows the count", async () => {
    const calls = mockApi(baseMocks(() => jsonResponse(pageOf(books, 1, 7))));
    renderWithProviders(<BooksWatchlistView />);
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();
    expect(booksUrls(calls)).toEqual([`${BASE}&sort=release_asc`]);
    expect(screen.getByRole("status")).toHaveTextContent("7 books");
  });

  it("shows the release date, or the year when no date is set, and no type chips or status icons", async () => {
    mockApi(baseMocks(() => jsonResponse(pageOf([{ ...earthsea, types: [hardcover] }, dated], 1, 2))));
    renderWithProviders(<BooksWatchlistView />);
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    expect(screen.getByText(String(earthsea.releaseYear))).toBeInTheDocument();
    expect(screen.getByText(dated.releaseDate!)).toBeInTheDocument();
    // The only text match is the add speed dial's (inert) action label, not a chip on a card.
    expect(screen.getAllByText("Hardcover")).toHaveLength(1);
    expect(screen.queryByRole("menuitem", { name: "Hardcover" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Watchlist" })).not.toBeInTheDocument();
  });

  it("switches to newest-first, requests sort=release_desc and resets to page 1 from page 2", async () => {
    const user = userEvent.setup();
    const calls = mockApi(baseMocks(twoPages));
    renderWithProviders(<BooksWatchlistView />);
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: DARKNESS })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Newest first" }));

    await waitFor(() =>
      expect(booksUrls(calls)).toEqual([
        `${BASE}&sort=release_asc`,
        `/api/books?page=2&pageSize=${BOOKS_PAGE_SIZE}&ownership=watchlist&sort=release_asc`,
        `${BASE}&sort=release_desc`,
      ]),
    );
    expect(currentLocation()).toBe("/?sort=release_desc");
  });

  it("issues no extra request when the already-selected toggle is clicked again", async () => {
    const user = userEvent.setup();
    const calls = mockApi(baseMocks());
    renderWithProviders(<BooksWatchlistView />);
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Oldest first" }));
    expect(booksUrls(calls)).toEqual([`${BASE}&sort=release_asc`]);
  });

  it("adds the selected type filter to the request and URL", async () => {
    const user = userEvent.setup();
    const calls = mockApi(baseMocks());
    renderWithProviders(<BooksWatchlistView />);
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    await waitForTypeSelect();
    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.click(screen.getByRole("option", { name: "Hardcover" }));

    await waitFor(() =>
      expect(booksUrls(calls)).toContain(
        `/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}&typeIds=${hardcover.id}&ownership=watchlist&sort=release_asc`,
      ),
    );
    expect(currentLocation()).toBe(`/?type=${hardcover.id}`);
  });

  it("loads the state of a deep link", async () => {
    const calls = mockApi(baseMocks());
    renderWithProviders(<BooksWatchlistView />, {
      route: `/books/watchlist?search=left&type=${hardcover.id}&sort=release_desc&page=2`,
    });
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();
    expect(booksUrls(calls)).toEqual([
      `/api/books?page=2&pageSize=${BOOKS_PAGE_SIZE}&search=left&typeIds=${hardcover.id}&ownership=watchlist&sort=release_desc`,
    ]);
    expect(screen.getByRole("searchbox", { name: "Search books" })).toHaveValue("left");
    expect(screen.getByRole("button", { name: "Newest first" })).toHaveAttribute("aria-pressed", "true");
  });

  it("sends one request with the search term after the debounce and shows the matches", async () => {
    const user = userEvent.setup();
    const calls = mockApi(
      baseMocks((_call, url) => {
        const search = (url.searchParams.get("search") ?? "").toLowerCase();
        if (search.length === 0) return jsonResponse(pageOf([earthsea], 1, 1));
        const matches = books.filter((b) => b.title.toLowerCase().includes(search));
        return jsonResponse(pageOf(matches, 1, matches.length));
      }),
    );
    renderWithProviders(<BooksWatchlistView />, { searchDebounceMs: 300 });
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search books" }));
    await user.paste("darkness");
    expect(booksUrls(calls)).toEqual([`${BASE}&sort=release_asc`]);

    expect(await screen.findByRole("heading", { name: DARKNESS })).toBeInTheDocument();
    expect(booksUrls(calls)).toEqual([
      `${BASE}&sort=release_asc`,
      `/api/books?page=1&pageSize=${BOOKS_PAGE_SIZE}&search=darkness&ownership=watchlist&sort=release_asc`,
    ]);
  });

  it("shows the watchlist-empty state when nothing is on the watchlist", async () => {
    mockApi(baseMocks(() => jsonResponse(pageOf([], 1, 0))));
    renderWithProviders(<BooksWatchlistView />);
    expect(await screen.findByText("Your watchlist is empty.")).toBeInTheDocument();
  });

  it("shows the search-specific empty state when nothing matches", async () => {
    const user = userEvent.setup();
    mockApi(
      baseMocks((_call, url) =>
        url.searchParams.has("search") ? jsonResponse(pageOf([], 1, 0)) : jsonResponse(pageOf(books, 1, 2)),
      ),
    );
    renderWithProviders(<BooksWatchlistView />);
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search books" }));
    await user.paste("zzz");

    expect(await screen.findByText('No books match "zzz"')).toBeInTheDocument();
    expect(screen.queryByText("Your watchlist is empty.")).not.toBeInTheDocument();
  });

  it("shows the filter-specific empty state and keeps the filter row so it can be undone", async () => {
    const user = userEvent.setup();
    mockApi(
      baseMocks((_call, url) =>
        url.searchParams.has("typeIds") ? jsonResponse(pageOf([], 1, 0)) : jsonResponse(pageOf(books, 1, 2)),
      ),
    );
    renderWithProviders(<BooksWatchlistView />, { realStyles: true });
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    await waitForTypeSelect();
    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.click(screen.getByRole("option", { name: "Hardcover" }));
    expect(await screen.findByText("No books match the selected filters.")).toBeInTheDocument();
    expect(screen.queryByText("Your watchlist is empty.")).not.toBeInTheDocument();

    // A multi-select stays open after a pick, and its menu hides the page from the accessibility tree.
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("status")).toHaveTextContent("0 books");
    expect(isResultsRowHidden()).toBe(false);
    expect(screen.getByRole("group", { name: "Sort order" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear Type" }));
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();
  });

  it("hides the filter row for a watchlist without any book", async () => {
    mockApi(baseMocks(() => jsonResponse(pageOf([], 1, 0))));
    renderWithProviders(<BooksWatchlistView />, { realStyles: true });
    expect(await screen.findByText("Your watchlist is empty.")).toBeInTheDocument();

    expect(isResultsRowHidden()).toBe(true);
    expect(screen.queryByRole("group", { name: "Sort order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Type" })).not.toBeInTheDocument();
  });

  it("opens the detail dialog from a card", async () => {
    const user = userEvent.setup();
    mockApi(baseMocks());
    renderWithProviders(<BooksWatchlistView />);
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: EARTHSEA }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: EARTHSEA })).toBeInTheDocument();
  });

  it("opens the add dialog from the FAB", async () => {
    const user = userEvent.setup();
    mockApi(baseMocks(() => jsonResponse(pageOf([], 1, 0))));
    renderWithProviders(<BooksWatchlistView />);
    expect(await screen.findByText("Your watchlist is empty.")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: "Add book" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Add book" }));
    expect(await screen.findByRole("dialog", { name: "Add book" })).toBeInTheDocument();
  });

  it("shows the previous page after deleting the last book of a later page", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...baseMocks(twoPages), "DELETE /api/books/:id": () => noContent() });
    renderWithProviders(<BooksWatchlistView />);
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: DARKNESS })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: DARKNESS }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText(`Delete "${DARKNESS}"?`);
    // Selects the last-mounted (topmost) portal: the confirm dialog stacked over the detail dialog.
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();
    expect(calls).toContainEqual({ method: "DELETE", url: "/api/books/book-3", body: undefined });
    const deleteIndex = calls.findIndex((c) => c.method === "DELETE");
    const afterDelete = calls.slice(deleteIndex + 1).filter((c) => c.url.startsWith("/api/books?"));
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].url).toContain("page=1");
  });

  it("shows no empty state while a page reload is still in flight (clearing a zero-result search)", async () => {
    const user = userEvent.setup();
    const resolvers: ((response: Response) => void)[] = [];
    mockApi(baseMocks(() => new Promise<Response>((resolve) => resolvers.push(resolve))));
    renderWithProviders(<BooksWatchlistView />);
    await waitFor(() => expect(resolvers).toHaveLength(1));
    resolvers[0](jsonResponse(pageOf(books, 1, 2)));
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search books" }));
    await user.paste("zzz");
    await waitFor(() => expect(resolvers).toHaveLength(2));
    resolvers[1](jsonResponse(pageOf([], 1, 0)));
    expect(await screen.findByText('No books match "zzz"')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.queryByText("Your watchlist is empty.")).not.toBeInTheDocument();
    await waitFor(() => expect(resolvers).toHaveLength(3));
    resolvers[2](jsonResponse(pageOf(books, 1, 2)));
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();
    expect(screen.queryByText("Your watchlist is empty.")).not.toBeInTheDocument();
  });

  it("clears the search immediately with the clear button and drops the search param", async () => {
    const user = userEvent.setup();
    const calls = mockApi(
      baseMocks((_call, url) => {
        const search = (url.searchParams.get("search") ?? "").toLowerCase();
        if (search.length === 0) return jsonResponse(pageOf([earthsea], 1, 1));
        const matches = books.filter((b) => b.title.toLowerCase().includes(search));
        return jsonResponse(pageOf(matches, 1, matches.length));
      }),
    );
    // A debounce far beyond the waitFor timeout below: only an explicit flush can bring Earthsea back in time.
    renderWithProviders(<BooksWatchlistView />, { searchDebounceMs: 5000 });
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search books" }));
    await user.paste("darkness");
    await user.keyboard("{Enter}");
    await screen.findByRole("heading", { name: DARKNESS });

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: EARTHSEA })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: DARKNESS })).not.toBeInTheDocument();
        expect(booksUrls(calls).at(-1)).toBe(`${BASE}&sort=release_asc`);
        expect(currentLocation()).not.toContain("search=");
      },
      { timeout: 500 },
    );
  });

  it("steps back to the previous page after editing the last page's only book to ownership owned", async () => {
    const user = userEvent.setup();
    let edited = false;
    const calls = mockApi({
      ...baseMocks((_call, url) => {
        const page = Number(url.searchParams.get("page"));
        if (!edited) return jsonResponse(pageOf(page === 1 ? books : [dated], page, BOOKS_PAGE_SIZE + 1));
        // `dated` no longer matches ownership=watchlist once edited to "owned": only `earthsea` is left, one page.
        return jsonResponse(pageOf(page === 1 ? [earthsea] : [], page, 1));
      }),
      "PATCH /api/books/:id": (call) => {
        edited = true;
        return jsonResponse({ ...dated, ...(call.body as object) });
      },
    });
    renderWithProviders(<BooksWatchlistView />);
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: DARKNESS })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: DARKNESS }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Owned" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    await flushAsync();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: DARKNESS })).not.toBeInTheDocument();
    expect(booksUrls(calls).at(-1)).toBe(`${BASE}&sort=release_asc`);
  });

  it("reloads the list after saving from the detail dialog", async () => {
    const user = userEvent.setup();
    let reloaded = false;
    const calls = mockApi({
      ...noTitleSuggestions("books"),
      ...baseMocks(() => {
        const items = reloaded ? [{ ...earthsea, title: "Earthsea (Revised)" }, dated] : books;
        reloaded = true;
        return jsonResponse(pageOf(items, 1, 2));
      }),
      "PATCH /api/books/:id": (call) => jsonResponse({ ...earthsea, ...(call.body as object) }),
    });
    renderWithProviders(<BooksWatchlistView />);
    expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: EARTHSEA }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.clear(title);
    await user.paste("Earthsea (Revised)");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("heading", { name: "Earthsea (Revised)" })).toBeInTheDocument();
    await waitFor(() => expect(booksUrls(calls)).toHaveLength(2));
  });

  describe("URL state", () => {
    const WATCHLIST_PATH = "/books/watchlist";
    const DESC = "release_desc";
    /** A link-like external navigation: pushes `to` onto the history. */
    function GoTo({ to }: { to: string }) {
      const navigate = useNavigate();
      return <button onClick={() => void navigate(to)}>Go to {to}</button>;
    }
    const lastBooksQuery = (calls: { url: string }[]) =>
      new URL(booksUrls(calls).at(-1)!, "http://localhost").searchParams;

    it("loads the state of a deep link and shows the controls as selected", async () => {
      const calls = mockApi(baseMocks(twoPages));
      renderWithProviders(<BooksWatchlistView />, {
        route: `${WATCHLIST_PATH}?search=left&type=${hardcover.id}&sort=${DESC}&page=2`,
      });

      expect(await screen.findByRole("heading", { name: DARKNESS })).toBeInTheDocument();
      expect(booksUrls(calls)).toHaveLength(1);
      expect(Object.fromEntries(lastBooksQuery(calls))).toEqual({
        page: "2",
        pageSize: String(BOOKS_PAGE_SIZE),
        search: "left",
        typeIds: hardcover.id,
        ownership: "watchlist",
        sort: DESC,
      });
      expect(screen.getByRole("searchbox", { name: "Search books" })).toHaveValue("left");
      expect(screen.getByRole("button", { name: "Newest first" })).toHaveAttribute("aria-pressed", "true");
      await waitFor(() => expect(screen.getByRole("combobox", { name: "Type" })).toHaveTextContent("Hardcover"));
    });

    it("replaces the URL with the debounced search and drops the page", async () => {
      const user = userEvent.setup();
      mockApi(baseMocks(twoPages));
      renderWithProviders(
        <>
          <BooksWatchlistView />
          <HistoryControls />
          <GoTo to={`${WATCHLIST_PATH}?page=2`} />
        </>,
        { route: WATCHLIST_PATH, searchDebounceMs: 300 },
      );
      await screen.findByRole("heading", { name: EARTHSEA });
      await user.click(screen.getByRole("button", { name: /^Go to \/books/ }));
      await screen.findByRole("heading", { name: DARKNESS });

      await user.click(screen.getByRole("searchbox", { name: "Search books" }));
      await user.paste("earthsea");
      // Positive control: the URL is untouched while the debounce is pending, and changes once it has passed.
      expect(currentLocation()).toBe(`${WATCHLIST_PATH}?page=2`);
      await waitFor(() => expect(currentLocation()).toBe(`${WATCHLIST_PATH}?search=earthsea`));

      // Replaced, not pushed: Back skips straight to the entry before the page-2 one.
      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(currentLocation()).toBe(WATCHLIST_PATH);
    });

    it("replaces the URL and drops the page when the type filter changes", async () => {
      const user = userEvent.setup();
      mockApi(baseMocks(twoPages));
      renderWithProviders(<BooksWatchlistView />, { route: `${WATCHLIST_PATH}?page=2&sort=${DESC}` });
      await screen.findByRole("heading", { name: DARKNESS });

      await waitForTypeSelect();
      await user.click(screen.getByRole("combobox", { name: "Type" }));
      await user.click(screen.getByRole("option", { name: "Hardcover" }));

      await waitFor(() => expect(currentLocation()).toBe(`${WATCHLIST_PATH}?type=${hardcover.id}&sort=${DESC}`));
    });

    it("replaces the URL and drops the page when the sort changes, omitting the default sort", async () => {
      const user = userEvent.setup();
      mockApi(baseMocks(twoPages));
      renderWithProviders(
        <>
          <BooksWatchlistView />
          <HistoryControls />
        </>,
        { route: WATCHLIST_PATH },
      );
      await screen.findByRole("heading", { name: EARTHSEA });
      await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
      await screen.findByRole("heading", { name: DARKNESS });
      expect(currentLocation()).toBe(`${WATCHLIST_PATH}?page=2`);

      await user.click(screen.getByRole("button", { name: "Newest first" }));
      await waitFor(() => expect(currentLocation()).toBe(`${WATCHLIST_PATH}?sort=${DESC}`));
      await user.click(screen.getByRole("button", { name: "Oldest first" }));
      await waitFor(() => expect(currentLocation()).toBe(WATCHLIST_PATH));

      // Both sort changes replaced the page-2 entry: one Back reaches the initial entry.
      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(currentLocation()).toBe(WATCHLIST_PATH);
    });

    it("pushes a history entry on a page change and Back returns to the previous page", async () => {
      const user = userEvent.setup();
      const scrollTo = vi.spyOn(window, "scrollTo");
      const calls = mockApi(baseMocks(twoPages));
      renderWithProviders(
        <>
          <BooksWatchlistView />
          <HistoryControls />
        </>,
        { route: WATCHLIST_PATH },
      );
      await screen.findByRole("heading", { name: EARTHSEA });

      await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
      expect(await screen.findByRole("heading", { name: DARKNESS })).toBeInTheDocument();
      expect(currentLocation()).toBe(`${WATCHLIST_PATH}?page=2`);
      expect(lastBooksQuery(calls).get("page")).toBe("2");
      expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0 });
      scrollTo.mockClear();

      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();
      expect(currentLocation()).toBe(WATCHLIST_PATH);
      expect(lastBooksQuery(calls).get("page")).toBe("1");
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("ignores junk params", async () => {
      const calls = mockApi(baseMocks());
      renderWithProviders(<BooksWatchlistView />, { route: `${WATCHLIST_PATH}?sort=title&page=0` });

      expect(await screen.findByRole("heading", { name: EARTHSEA })).toBeInTheDocument();
      expect(booksUrls(calls)).toEqual([`${BASE}&sort=${DEFAULT_WATCHLIST_SORT}`]);
      expect(screen.getByRole("button", { name: "Oldest first" })).toHaveAttribute("aria-pressed", "true");
    });

    it("does not add a history entry when an automatic page correction steps back", async () => {
      const user = userEvent.setup();
      const scrollTo = vi.spyOn(window, "scrollTo");
      // Page 2 comes back empty (e.g. its last book was edited away): the view corrects to page 1.
      mockApi(
        baseMocks((_call, url) => {
          const page = Number(url.searchParams.get("page"));
          return jsonResponse(pageOf(page === 1 ? books : [], page, 1));
        }),
      );
      renderWithProviders(
        <>
          <BooksWatchlistView />
          <HistoryControls />
          <GoTo to={`${WATCHLIST_PATH}?page=2`} />
        </>,
        { route: `${WATCHLIST_PATH}?sort=${DESC}` },
      );
      await screen.findByRole("heading", { name: EARTHSEA });
      await user.click(screen.getByRole("button", { name: `Go to ${WATCHLIST_PATH}?page=2` }));
      await waitFor(() => expect(currentLocation()).toBe(WATCHLIST_PATH));
      await screen.findByRole("heading", { name: EARTHSEA });

      // The correction replaced the `?page=2` entry: Back lands on the initial entry, not on the empty page.
      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(currentLocation()).toBe(`${WATCHLIST_PATH}?sort=${DESC}`);
      await flushAsync();
      expect(currentLocation()).toBe(`${WATCHLIST_PATH}?sort=${DESC}`);
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
