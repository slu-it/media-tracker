import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { currentLocation } from "../../test/currentLocation";
import { flushAsync } from "../../test/flushAsync";
import {
  bookTypes,
  duneSagaSummary,
  emptySeriesSummary,
  meta,
  mistborn,
  mistbornBooks,
  seriesSummaries,
} from "../../test/fixtures/books";
import { jsonResponse, mockApi, noContent } from "../../test/mockFetch";
import { renderWithProviders } from "../../test/renderWithProviders";
import { BookSeriesView } from "./BookSeriesView";

const SUMMARIES = "GET /api/book-series.summaries";
const MISTBORN_BOOKS = `GET /api/book-series/${mistborn.id}/books`;

const base = () => ({
  [SUMMARIES]: () => jsonResponse(seriesSummaries),
  "GET /api/book-types": () => jsonResponse(bookTypes),
  "GET /api/books.meta": () => jsonResponse(meta),
});

describe("BookSeriesView", () => {
  it("lists every series with its count and loads no books", async () => {
    const calls = mockApi(base());
    renderWithProviders(<BookSeriesView />);
    expect(await screen.findByRole("heading", { name: /^Mistborn/ })).toBeInTheDocument();
    const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(["Dune Saga1 book", "Éowyn Chronicles0 books", "Mistborn3 books"]);
    expect(screen.getByText("3 books")).toBeInTheDocument();
    expect(screen.getByText("0 books")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("3 series");
    expect(calls.some((c) => c.url.includes("/books") && c.url.includes("book-series/"))).toBe(false);
  });

  it("filters by search without any request", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<BookSeriesView />);
    await screen.findByRole("heading", { name: /^Mistborn/ });
    const before = calls.length;

    await user.click(screen.getByRole("searchbox", { name: "Search series" }));
    await user.paste("eowyn");
    await waitFor(() => expect(currentLocation()).toContain("search=eowyn"));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Éowyn Chronicles0 books"]);
    expect(screen.getByRole("status")).toHaveTextContent("1 series");

    await user.clear(screen.getByRole("searchbox", { name: "Search series" }));
    await user.paste("nothing");
    expect(await screen.findByText('No series match "nothing"')).toBeInTheDocument();
    expect(calls).toHaveLength(before);
  });

  it("shows the empty text without series", async () => {
    mockApi({ ...base(), [SUMMARIES]: () => jsonResponse([]) });
    renderWithProviders(<BookSeriesView />);
    expect(await screen.findByText("No series yet. Add one while editing a book.")).toBeInTheDocument();
  });

  it("fetches the books only on expand and shows them in backend order with badges", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), [MISTBORN_BOOKS]: () => jsonResponse(mistbornBooks) });
    renderWithProviders(<BookSeriesView />);
    await user.click(await screen.findByRole("button", { name: /Mistborn/ }));

    expect(await screen.findByRole("heading", { name: "The Final Empire" })).toBeInTheDocument();
    expect(calls.filter((c) => c.url === `/api/book-series/${mistborn.id}/books`)).toHaveLength(1);
    const titles = screen.getAllByRole("heading", { level: 3, hidden: true }).map((h) => h.textContent);
    expect(titles).toEqual(["The Final Empire", "The Well of Ascension", "Secret History"]);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2.5")).toBeInTheDocument();
    expect(screen.getAllByText(/^#/)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "The Final Empire" })).toHaveAccessibleDescription("#1");
    for (const card of screen.getAllByRole("button", {
      name: /^(The Final Empire|The Well of Ascension|Secret History)$/,
    })) {
      expect(card).not.toHaveAccessibleDescription(/Mistborn/);
    }
  });

  it("shows a message for a series without books, without a request", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<BookSeriesView />);
    await user.click(await screen.findByRole("button", { name: new RegExp(emptySeriesSummary.name) }));
    expect(await screen.findByText("No books in this series")).toBeInTheDocument();
    expect(calls.some((c) => /book-series\/.+\/books/.test(c.url))).toBe(false);
  });

  it("opens the detail dialog from a card", async () => {
    const user = userEvent.setup();
    mockApi({ ...base(), [MISTBORN_BOOKS]: () => jsonResponse(mistbornBooks) });
    renderWithProviders(<BookSeriesView />);
    await user.click(await screen.findByRole("button", { name: /Mistborn/ }));
    await user.click(await screen.findByRole("button", { name: /The Final Empire/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "The Final Empire" })).toBeInTheDocument();
  });

  it("reloads the summaries and the open section after a save", async () => {
    const user = userEvent.setup();
    let books = mistbornBooks;
    const calls = mockApi({
      ...base(),
      [MISTBORN_BOOKS]: () => jsonResponse(books),
      "PATCH /api/books/:id": (call) =>
        jsonResponse({ ...mistbornBooks[0], title: "Renamed", ...(call.body as object) }),
    });
    renderWithProviders(<BookSeriesView />);
    await user.click(await screen.findByRole("button", { name: /Mistborn/ }));
    await user.click(await screen.findByRole("button", { name: /The Final Empire/ }));
    const dialog = await screen.findByRole("dialog");
    expect(screen.getAllByRole("heading", { level: 3, hidden: true }).map((h) => h.textContent)).toEqual([
      "The Final Empire",
      "The Well of Ascension",
      "Secret History",
    ]);
    books = [mistbornBooks[1], mistbornBooks[0], mistbornBooks[2]];
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.clear(title);
    await user.paste("Renamed");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await flushAsync();
    // The old cards stay visible while the section reloads.
    expect(screen.getAllByRole("heading", { level: 3, hidden: true }).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(calls.filter((c) => c.url === "/api/book-series.summaries")).toHaveLength(2);
      expect(calls.filter((c) => c.url === `/api/book-series/${mistborn.id}/books`)).toHaveLength(2);
    });
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { level: 3, hidden: true }).map((h) => h.textContent)).toEqual([
        "The Well of Ascension",
        "The Final Empire",
        "Secret History",
      ]),
    );
  });

  it("closes the dialog and reloads the summaries and the open section after a delete", async () => {
    const user = userEvent.setup();
    let books = mistbornBooks;
    let summaries = seriesSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      [MISTBORN_BOOKS]: () => jsonResponse(books),
      "DELETE /api/books/:id": () => noContent(),
    });
    renderWithProviders(<BookSeriesView />);
    await user.click(await screen.findByRole("button", { name: /Mistborn/ }));
    await user.click(await screen.findByRole("button", { name: /The Final Empire/ }));
    const dialog = await screen.findByRole("dialog");
    books = mistbornBooks.slice(1);
    summaries = seriesSummaries.map((s) => (s.id === mistborn.id ? { ...s, bookCount: 2 } : s));
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "The Final Empire"?');
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContainEqual({ method: "DELETE", url: `/api/books/${mistbornBooks[0].id}`, body: undefined });
    await waitFor(() => {
      expect(calls.filter((c) => c.url === "/api/book-series.summaries")).toHaveLength(2);
      expect(calls.filter((c) => c.url === `/api/book-series/${mistborn.id}/books`)).toHaveLength(2);
    });
    expect(await screen.findByRole("heading", { name: /^Mistborn/ })).toHaveTextContent("Mistborn2 books");
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { level: 3, hidden: true }).map((h) => h.textContent)).toEqual([
        "The Well of Ascension",
        "Secret History",
      ]),
    );
  });

  it("shows an error with retry when the summaries fail", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      ...base(),
      [SUMMARIES]: () => (fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse([duneSagaSummary])),
    });
    renderWithProviders(<BookSeriesView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: /^Dune Saga/ })).toBeInTheDocument();
  });
});
