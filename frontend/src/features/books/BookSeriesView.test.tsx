import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { currentLocation } from "../../test/currentLocation";
import { flushAsync } from "../../test/flushAsync";
import {
  bookTypes,
  duneSaga,
  duneSagaSummary,
  emptySeriesSummary,
  meta,
  mistborn,
  mistbornBooks,
  seriesSummaries,
} from "../../test/fixtures/books";
import { jsonResponse, mockApi, noContent, noTitleSuggestions } from "../../test/mockFetch";
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

  it("sorts by volume and back, writing the URL without a request", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<BookSeriesView />);
    await screen.findAllByRole("heading", { level: 2 });
    const before = calls.length;

    await user.click(screen.getByRole("button", { name: "Most books" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Mistborn3 books",
      "Dune Saga1 book",
      "Éowyn Chronicles0 books",
    ]);
    expect(currentLocation()).toContain("sort=volume");

    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Dune Saga1 book",
      "Éowyn Chronicles0 books",
      "Mistborn3 books",
    ]);
    expect(currentLocation()).not.toContain("sort");
    expect(calls).toHaveLength(before);
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

  it("offers edit in every section and delete only in the expanded section of a series without books", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), [MISTBORN_BOOKS]: () => jsonResponse(mistbornBooks) });
    renderWithProviders(<BookSeriesView />);
    await user.click(await screen.findByRole("button", { name: /^Éowyn Chronicles/ }));
    expect(screen.getByRole("button", { name: "Rename series Éowyn Chronicles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete series Éowyn Chronicles" })).toBeInTheDocument();
    expect(screen.getByText("No books in this series")).toBeInTheDocument();
    expect(calls.some((c) => c.url === `/api/book-series/${emptySeriesSummary.id}/books`)).toBe(false);

    await user.click(screen.getByRole("button", { name: /^Mistborn/ }));
    expect(await screen.findByRole("button", { name: "Rename series Mistborn" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Delete series / })).toHaveLength(1);
  });

  it("keeps the series and sends no request when the delete is declined", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<BookSeriesView />);
    await user.click(await screen.findByRole("button", { name: /^Éowyn Chronicles/ }));
    await user.click(await screen.findByRole("button", { name: "Delete series Éowyn Chronicles" }));
    expect(await screen.findByText('Delete series "Éowyn Chronicles"?')).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "No" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Delete series Éowyn Chronicles" })).toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("deletes an unused series and reloads the summaries", async () => {
    const user = userEvent.setup();
    let summaries = seriesSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      "DELETE /api/book-series/:id": () => noContent(),
    });
    renderWithProviders(<BookSeriesView />);
    await user.click(await screen.findByRole("button", { name: /^Éowyn Chronicles/ }));
    await user.click(await screen.findByRole("button", { name: "Delete series Éowyn Chronicles" }));
    summaries = summaries.filter((s) => s.id !== emptySeriesSummary.id);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Delete series Éowyn Chronicles" })).not.toBeInTheDocument(),
    );
    expect(calls).toContainEqual({
      method: "DELETE",
      url: `/api/book-series/${emptySeriesSummary.id}`,
      body: undefined,
    });
    expect(calls.filter((c) => c.url === "/api/book-series.summaries")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: /^Éowyn Chronicles/ })).not.toBeInTheDocument();
  });

  it("shows an error and keeps the series when the delete fails", async () => {
    const user = userEvent.setup();
    mockApi({
      ...base(),
      "DELETE /api/book-series/:id": () => jsonResponse({ error: "conflict" }, 409),
    });
    renderWithProviders(<BookSeriesView />);
    await user.click(await screen.findByRole("button", { name: /^Éowyn Chronicles/ }));
    await user.click(await screen.findByRole("button", { name: "Delete series Éowyn Chronicles" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Deleting failed.");
    expect(screen.getByRole("button", { name: "Delete series Éowyn Chronicles" })).toBeEnabled();
  });

  const openRename = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("button", { name: /^Éowyn Chronicles/ }));
    await user.click(await screen.findByRole("button", { name: "Rename series Éowyn Chronicles" }));
    return screen.findByRole("dialog", { name: "Rename series" });
  };

  it("renames a series and reloads the summaries", async () => {
    const user = userEvent.setup();
    let summaries = seriesSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      "PATCH /api/book-series/:id": (call) => jsonResponse({ id: emptySeriesSummary.id, ...(call.body as object) }),
    });
    renderWithProviders(<BookSeriesView />);
    const dialog = await openRename(user);
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("Éowyn Chronicles");
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    summaries = summaries.map((s) => (s.id === emptySeriesSummary.id ? { ...s, name: "Renamed" } : s));
    await user.clear(name);
    await user.paste("  Renamed ");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContainEqual({
      method: "PATCH",
      url: `/api/book-series/${emptySeriesSummary.id}`,
      body: { name: "Renamed" },
    });
    expect(await screen.findByRole("heading", { name: /^Renamed/ })).toBeInTheDocument();
    expect(calls.filter((x) => x.url === "/api/book-series.summaries")).toHaveLength(2);
  });

  it("rejects an empty name and sends nothing", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<BookSeriesView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    expect(within(dialog).getByText("Required")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(calls.some((x) => x.method === "PATCH")).toBe(false);
  });

  const takenBody = { error: "name_taken", existingId: mistborn.id, existingName: mistborn.name };

  it("offers to merge when the name is taken and merges on confirm", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...base(),
      "PATCH /api/book-series/:id": () => jsonResponse(takenBody, 409),
      "POST /api/book-series/:id/merge": () => jsonResponse(mistborn),
    });
    renderWithProviders(<BookSeriesView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("mistborn");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    const choice = await screen.findByText(/already exists/);
    expect(choice).toHaveTextContent('A series named "Mistborn" already exists. Merge "Éowyn Chronicles" into it?');
    await user.click(screen.getByRole("button", { name: "Merge" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContainEqual({
      method: "POST",
      url: `/api/book-series/${emptySeriesSummary.id}/merge`,
      body: { targetId: mistborn.id },
    });
    expect(calls.filter((x) => x.url === "/api/book-series.summaries")).toHaveLength(2);
  });

  it("shows an error in the dialog when the merge fails", async () => {
    const user = userEvent.setup();
    mockApi({
      ...base(),
      "PATCH /api/book-series/:id": () => jsonResponse(takenBody, 409),
      "POST /api/book-series/:id/merge": () => jsonResponse({ error: "internal_error" }, 500),
    });
    renderWithProviders(<BookSeriesView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("mistborn");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Merge" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Saving failed.");
  });

  it("collapses the merged-away series and requests none of its books afterwards", async () => {
    const user = userEvent.setup();
    let summaries = seriesSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      [MISTBORN_BOOKS]: () => jsonResponse(mistbornBooks),
      "PATCH /api/book-series/:id": () =>
        jsonResponse({ error: "name_taken", existingId: duneSaga.id, existingName: duneSaga.name }, 409),
      "POST /api/book-series/:id/merge": () => jsonResponse(duneSaga),
    });
    renderWithProviders(<BookSeriesView />);
    await user.click(await screen.findByRole("button", { name: /^Mistborn/ }));
    await user.click(await screen.findByRole("button", { name: "Rename series Mistborn" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename series" });
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("dune saga");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    summaries = summaries.filter((x) => x.id !== mistborn.id);
    await user.click(await screen.findByRole("button", { name: "Merge" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: /^Mistborn/ })).not.toBeInTheDocument());
    expect(calls.filter((c) => c.url === `/api/book-series/${mistborn.id}/books`)).toHaveLength(1);
  });

  it("returns to the rename dialog with the typed name on Choose another name", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), "PATCH /api/book-series/:id": () => jsonResponse(takenBody, 409) });
    renderWithProviders(<BookSeriesView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("mistborn");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Choose another name" }));

    await waitFor(() => expect(screen.queryByText(/already exists/)).not.toBeInTheDocument());
    const again = await screen.findByRole("dialog", { name: "Rename series" });
    expect(within(again).getByRole("textbox", { name: "Name" })).toHaveValue("mistborn");
    expect(calls.some((x) => x.method === "POST")).toBe(false);
  });

  it("shows an error in the dialog when the rename fails", async () => {
    const user = userEvent.setup();
    mockApi({ ...base(), "PATCH /api/book-series/:id": () => jsonResponse({ error: "internal_error" }, 500) });
    renderWithProviders(<BookSeriesView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("Renamed");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Saving failed.");
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Renamed");
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
      ...noTitleSuggestions("books"),
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
