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
  leGuin,
  leGuinSummary,
  meta,
} from "../../test/fixtures/books";
import { jsonResponse, mockApi, noContent, noTitleSuggestions } from "../../test/mockFetch";
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

  it("sorts by volume with ties in alphabetical order, writes the URL and sends no request", async () => {
    const user = userEvent.setup();
    const tie = [{ ...emptyAuthorSummary, bookCount: 1 }, herbertSummary, { ...leGuinSummary, bookCount: 1 }];
    const calls = mockApi({ ...base(), [SUMMARIES]: () => jsonResponse(tie) });
    renderWithProviders(<BookAuthorsView />);
    await screen.findByRole("heading", { name: /^Frank Herbert/ });
    const before = calls.length;
    const names = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

    await user.click(screen.getByRole("button", { name: "Most books" }));
    expect(names()).toEqual(["Frank Herbert2 books", "Émile Zola1 book", "Ursula K. Le Guin1 book"]);
    expect(currentLocation()).toContain("sort=volume");

    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(names()).toEqual(["Émile Zola1 book", "Frank Herbert2 books", "Ursula K. Le Guin1 book"]);
    expect(currentLocation()).not.toContain("sort");
    expect(calls).toHaveLength(before);
  });

  it("starts sorted by volume from the deep link and keeps sort and search together", async () => {
    const user = userEvent.setup();
    mockApi(base());
    renderWithProviders(<BookAuthorsView />, { route: "/?sort=volume" });
    await screen.findByRole("heading", { name: /^Frank Herbert/ });
    const names = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names()).toEqual(["Frank Herbert2 books", "Ursula K. Le Guin1 book", "Émile Zola0 books"]);
    expect(screen.getByRole("button", { name: "Most books" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("searchbox", { name: "Search authors" }));
    await user.paste("r");
    await waitFor(() => expect(currentLocation()).toContain("search=r"));
    expect(currentLocation()).toContain("sort=volume");
    expect(names()).toEqual(["Frank Herbert2 books", "Ursula K. Le Guin1 book"]);

    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(currentLocation()).toContain("search=r");
    expect(currentLocation()).not.toContain("sort");
  });

  it("shows the empty text without authors", async () => {
    mockApi({ ...base(), [SUMMARIES]: () => jsonResponse([]) });
    renderWithProviders(<BookAuthorsView />);
    expect(await screen.findByText("No authors yet. Add one while editing a book.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Most books" })).not.toBeInTheDocument();
  });

  it("keeps the sort toggle when a search matches nothing", async () => {
    const user = userEvent.setup();
    mockApi(base());
    renderWithProviders(<BookAuthorsView />);
    await screen.findByRole("heading", { name: /^Frank Herbert/ });
    await user.click(screen.getByRole("searchbox", { name: "Search authors" }));
    await user.paste("nothing");
    expect(await screen.findByText('No authors match "nothing"')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Most books" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 authors");
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

  it("shows the series chip on an expanded author's card", async () => {
    const user = userEvent.setup();
    mockApi({ ...base(), [HERBERT_BOOKS]: () => jsonResponse(herbertBooks) });
    renderWithProviders(<BookAuthorsView />);
    await user.click(await screen.findByRole("button", { name: /Frank Herbert/ }));
    expect(await screen.findByRole("heading", { name: "Dune Messiah" })).toBeInTheDocument();
    expect(screen.getByText("Dune Saga #1")).toBeInTheDocument();
  });

  it("offers edit in every section and delete only in the expanded section of an author without books", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), [HERBERT_BOOKS]: () => jsonResponse(herbertBooks) });
    renderWithProviders(<BookAuthorsView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Zola/ }));
    expect(screen.getByRole("button", { name: "Rename author Émile Zola" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete author Émile Zola" })).toBeInTheDocument();
    expect(screen.getByText("No books by this author")).toBeInTheDocument();
    expect(calls.some((c) => c.url === `/api/book-authors/${emptyAuthorSummary.id}/books`)).toBe(false);

    await user.click(screen.getByRole("button", { name: /^Frank Herbert/ }));
    expect(await screen.findByRole("button", { name: "Rename author Frank Herbert" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Delete author / })).toHaveLength(1);
  });

  it("keeps the author and sends no request when the delete is declined", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<BookAuthorsView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Zola/ }));
    await user.click(await screen.findByRole("button", { name: "Delete author Émile Zola" }));
    expect(await screen.findByText('Delete author "Émile Zola"?')).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "No" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Delete author Émile Zola" })).toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("deletes an unused author and reloads the summaries", async () => {
    const user = userEvent.setup();
    let summaries = authorSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      "DELETE /api/book-authors/:id": () => noContent(),
    });
    renderWithProviders(<BookAuthorsView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Zola/ }));
    await user.click(await screen.findByRole("button", { name: "Delete author Émile Zola" }));
    summaries = summaries.filter((s) => s.id !== emptyAuthorSummary.id);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Delete author Émile Zola" })).not.toBeInTheDocument(),
    );
    expect(calls).toContainEqual({
      method: "DELETE",
      url: `/api/book-authors/${emptyAuthorSummary.id}`,
      body: undefined,
    });
    expect(calls.filter((c) => c.url === "/api/book-authors.summaries")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: /^Émile Zola/ })).not.toBeInTheDocument();
  });

  it("shows an error and keeps the author when the delete fails", async () => {
    const user = userEvent.setup();
    mockApi({
      ...base(),
      "DELETE /api/book-authors/:id": () => jsonResponse({ error: "conflict" }, 409),
    });
    renderWithProviders(<BookAuthorsView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Zola/ }));
    await user.click(await screen.findByRole("button", { name: "Delete author Émile Zola" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Deleting failed.");
    expect(screen.getByRole("button", { name: "Delete author Émile Zola" })).toBeEnabled();
  });

  it("reloads the summaries when the delete fails", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...base(),
      "DELETE /api/book-authors/:id": () => jsonResponse({ error: "conflict" }, 409),
    });
    renderWithProviders(<BookAuthorsView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Zola/ }));
    await user.click(await screen.findByRole("button", { name: "Delete author Émile Zola" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(calls.filter((c) => c.url === "/api/book-authors.summaries")).toHaveLength(2));
    expect(await screen.findByRole("alert")).toHaveTextContent("Deleting failed.");
  });

  const openRename = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("button", { name: /^Émile Zola/ }));
    await user.click(await screen.findByRole("button", { name: "Rename author Émile Zola" }));
    return screen.findByRole("dialog", { name: "Rename author" });
  };

  it("renames an author and reloads the summaries", async () => {
    const user = userEvent.setup();
    let summaries = authorSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      "PATCH /api/book-authors/:id": (call) => jsonResponse({ id: emptyAuthorSummary.id, ...(call.body as object) }),
    });
    renderWithProviders(<BookAuthorsView />);
    const dialog = await openRename(user);
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("Émile Zola");
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    summaries = summaries.map((s) => (s.id === emptyAuthorSummary.id ? { ...s, name: "Renamed" } : s));
    await user.clear(name);
    await user.paste("  Renamed ");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContainEqual({
      method: "PATCH",
      url: `/api/book-authors/${emptyAuthorSummary.id}`,
      body: { name: "Renamed" },
    });
    expect(await screen.findByRole("heading", { name: /^Renamed/ })).toBeInTheDocument();
    expect(calls.filter((x) => x.url === "/api/book-authors.summaries")).toHaveLength(2);
  });

  it("rejects an empty name and sends nothing", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<BookAuthorsView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    expect(within(dialog).getByText("Required")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(calls.some((x) => x.method === "PATCH")).toBe(false);
  });

  const takenBody = { error: "name_taken", existingId: leGuin.id, existingName: leGuin.name };

  it("offers to merge when the name is taken and merges on confirm", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...base(),
      "PATCH /api/book-authors/:id": () => jsonResponse(takenBody, 409),
      "POST /api/book-authors/:id/merge": () => jsonResponse(leGuin),
    });
    renderWithProviders(<BookAuthorsView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("ursula k. le guin");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    const choice = await screen.findByText(/already exists/);
    expect(choice).toHaveTextContent('An author named "Ursula K. Le Guin" already exists. Merge "Émile Zola" into it?');
    await user.click(screen.getByRole("button", { name: "Merge" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContainEqual({
      method: "POST",
      url: `/api/book-authors/${emptyAuthorSummary.id}/merge`,
      body: { targetId: leGuin.id },
    });
    expect(calls.filter((x) => x.url === "/api/book-authors.summaries")).toHaveLength(2);
  });

  it("shows an error in the dialog when the merge fails", async () => {
    const user = userEvent.setup();
    mockApi({
      ...base(),
      "PATCH /api/book-authors/:id": () => jsonResponse(takenBody, 409),
      "POST /api/book-authors/:id/merge": () => jsonResponse({ error: "internal_error" }, 500),
    });
    renderWithProviders(<BookAuthorsView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("ursula k. le guin");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Merge" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Saving failed.");
  });

  it("collapses the merged-away author and requests none of its books afterwards", async () => {
    const user = userEvent.setup();
    let summaries = authorSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      [HERBERT_BOOKS]: () => jsonResponse(herbertBooks),
      "PATCH /api/book-authors/:id": () =>
        jsonResponse({ error: "name_taken", existingId: leGuin.id, existingName: leGuin.name }, 409),
      "POST /api/book-authors/:id/merge": () => jsonResponse(leGuin),
    });
    renderWithProviders(<BookAuthorsView />);
    await user.click(await screen.findByRole("button", { name: /^Frank Herbert/ }));
    await user.click(await screen.findByRole("button", { name: "Rename author Frank Herbert" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename author" });
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("ursula k. le guin");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    summaries = summaries.filter((x) => x.id !== herbert.id);
    await user.click(await screen.findByRole("button", { name: "Merge" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: /^Frank Herbert/ })).not.toBeInTheDocument());
    expect(calls.filter((c) => c.url === `/api/book-authors/${herbert.id}/books`)).toHaveLength(1);
  });

  it("returns to the rename dialog with the typed name on Choose another name", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), "PATCH /api/book-authors/:id": () => jsonResponse(takenBody, 409) });
    renderWithProviders(<BookAuthorsView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("ursula k. le guin");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Choose another name" }));

    await waitFor(() => expect(screen.queryByText(/already exists/)).not.toBeInTheDocument());
    const again = await screen.findByRole("dialog", { name: "Rename author" });
    expect(within(again).getByRole("textbox", { name: "Name" })).toHaveValue("ursula k. le guin");
    expect(calls.some((x) => x.method === "POST")).toBe(false);
  });

  it("shows an error in the dialog when the rename fails", async () => {
    const user = userEvent.setup();
    mockApi({ ...base(), "PATCH /api/book-authors/:id": () => jsonResponse({ error: "internal_error" }, 500) });
    renderWithProviders(<BookAuthorsView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("Renamed");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Saving failed.");
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Renamed");
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
      ...noTitleSuggestions("books"),
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
    const title = within(dialog).getByRole("combobox", { name: /title/i });
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
