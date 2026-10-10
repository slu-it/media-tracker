import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { currentLocation } from "../../test/currentLocation";
import { flushAsync } from "../../test/flushAsync";
import {
  narratorSummaries,
  bookTypes,
  emptyNarratorSummary,
  simonVance,
  vanceBooks,
  simonVanceSummary,
  scottBrick,
  meta,
} from "../../test/fixtures/books";
import { jsonResponse, mockApi, noContent, noTitleSuggestions } from "../../test/mockFetch";
import { renderWithProviders } from "../../test/renderWithProviders";
import { BookNarratorsView } from "./BookNarratorsView";

const SUMMARIES = "GET /api/book-narrators.summaries";
const VANCE_BOOKS = `GET /api/book-narrators/${simonVance.id}/books`;

const base = () => ({
  [SUMMARIES]: () => jsonResponse(narratorSummaries),
  "GET /api/book-types": () => jsonResponse(bookTypes),
  "GET /api/books.meta": () => jsonResponse(meta),
});

const cardTitles = () => screen.getAllByRole("heading", { level: 3, hidden: true }).map((h) => h.textContent);

describe("BookNarratorsView", () => {
  it("lists every narrator with the count and loads no books", async () => {
    const calls = mockApi(base());
    renderWithProviders(<BookNarratorsView />);
    expect(await screen.findByRole("heading", { name: /^Simon Vance/ })).toBeInTheDocument();
    const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(["Émile Zola0 books", "Scott Brick1 book", "Simon Vance2 books"]);
    expect(screen.getByRole("status")).toHaveTextContent("3 narrators");
    expect(calls.some((c) => c.url.includes("book-narrators/"))).toBe(false);
  });

  it("filters by search without any request", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<BookNarratorsView />);
    await screen.findByRole("heading", { name: /^Simon Vance/ });
    const before = calls.length;

    await user.click(screen.getByRole("searchbox", { name: "Search narrators" }));
    await user.paste("emile");
    await waitFor(() => expect(currentLocation()).toContain("search=emile"));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Émile Zola0 books"]);
    expect(screen.getByRole("status")).toHaveTextContent("1 narrator");

    await user.clear(screen.getByRole("searchbox", { name: "Search narrators" }));
    await user.paste("nothing");
    expect(await screen.findByText('No narrators match "nothing"')).toBeInTheDocument();
    expect(calls).toHaveLength(before);
  });

  it("shows the empty text without narrators", async () => {
    mockApi({ ...base(), [SUMMARIES]: () => jsonResponse([]) });
    renderWithProviders(<BookNarratorsView />);
    expect(await screen.findByText("No narrators yet. Add one while editing a book.")).toBeInTheDocument();
  });

  it("fetches the books only on expand and shows them in backend order without badges", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), [VANCE_BOOKS]: () => jsonResponse(vanceBooks) });
    renderWithProviders(<BookNarratorsView />);
    await user.click(await screen.findByRole("button", { name: /Simon Vance/ }));

    expect(await screen.findByRole("heading", { name: "Dune Messiah" })).toBeInTheDocument();
    expect(calls.filter((c) => c.url === `/api/book-narrators/${simonVance.id}/books`)).toHaveLength(1);
    expect(cardTitles()).toEqual(["Dune", "Dune Messiah"]);
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
  });

  it("shows the series chip on an expanded narrator's card", async () => {
    const user = userEvent.setup();
    mockApi({ ...base(), [VANCE_BOOKS]: () => jsonResponse(vanceBooks) });
    renderWithProviders(<BookNarratorsView />);
    await user.click(await screen.findByRole("button", { name: /Simon Vance/ }));
    expect(await screen.findByRole("heading", { name: "Dune Messiah" })).toBeInTheDocument();
    expect(screen.getByText("Dune Saga #1")).toBeInTheDocument();
  });

  it("offers edit in every section and delete only in the expanded section of a narrator without books", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), [VANCE_BOOKS]: () => jsonResponse(vanceBooks) });
    renderWithProviders(<BookNarratorsView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Zola/ }));
    expect(screen.getByRole("button", { name: "Rename narrator Émile Zola" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete narrator Émile Zola" })).toBeInTheDocument();
    expect(screen.getByText("No books narrated by this narrator")).toBeInTheDocument();
    expect(calls.some((c) => c.url === `/api/book-narrators/${emptyNarratorSummary.id}/books`)).toBe(false);

    await user.click(screen.getByRole("button", { name: /^Simon Vance/ }));
    expect(await screen.findByRole("button", { name: "Rename narrator Simon Vance" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Delete narrator / })).toHaveLength(1);
  });

  it("keeps the narrator and sends no request when the delete is declined", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<BookNarratorsView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Zola/ }));
    await user.click(await screen.findByRole("button", { name: "Delete narrator Émile Zola" }));
    expect(await screen.findByText('Delete narrator "Émile Zola"?')).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "No" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Delete narrator Émile Zola" })).toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("deletes an unused narrator and reloads the summaries", async () => {
    const user = userEvent.setup();
    let summaries = narratorSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      "DELETE /api/book-narrators/:id": () => noContent(),
    });
    renderWithProviders(<BookNarratorsView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Zola/ }));
    await user.click(await screen.findByRole("button", { name: "Delete narrator Émile Zola" }));
    summaries = summaries.filter((s) => s.id !== emptyNarratorSummary.id);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Delete narrator Émile Zola" })).not.toBeInTheDocument(),
    );
    expect(calls).toContainEqual({
      method: "DELETE",
      url: `/api/book-narrators/${emptyNarratorSummary.id}`,
      body: undefined,
    });
    expect(calls.filter((c) => c.url === "/api/book-narrators.summaries")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: /^Émile Zola/ })).not.toBeInTheDocument();
  });

  it("shows an error and keeps the narrator when the delete fails", async () => {
    const user = userEvent.setup();
    mockApi({
      ...base(),
      "DELETE /api/book-narrators/:id": () => jsonResponse({ error: "conflict" }, 409),
    });
    renderWithProviders(<BookNarratorsView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Zola/ }));
    await user.click(await screen.findByRole("button", { name: "Delete narrator Émile Zola" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Deleting failed.");
    expect(screen.getByRole("button", { name: "Delete narrator Émile Zola" })).toBeEnabled();
  });

  it("reloads the summaries when the delete fails", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...base(),
      "DELETE /api/book-narrators/:id": () => jsonResponse({ error: "conflict" }, 409),
    });
    renderWithProviders(<BookNarratorsView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Zola/ }));
    await user.click(await screen.findByRole("button", { name: "Delete narrator Émile Zola" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(calls.filter((c) => c.url === "/api/book-narrators.summaries")).toHaveLength(2));
    expect(await screen.findByRole("alert")).toHaveTextContent("Deleting failed.");
  });

  const openRename = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("button", { name: /^Émile Zola/ }));
    await user.click(await screen.findByRole("button", { name: "Rename narrator Émile Zola" }));
    return screen.findByRole("dialog", { name: "Rename narrator" });
  };

  it("renames a narrator and reloads the summaries", async () => {
    const user = userEvent.setup();
    let summaries = narratorSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      "PATCH /api/book-narrators/:id": (call) =>
        jsonResponse({ id: emptyNarratorSummary.id, ...(call.body as object) }),
    });
    renderWithProviders(<BookNarratorsView />);
    const dialog = await openRename(user);
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("Émile Zola");
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    summaries = summaries.map((s) => (s.id === emptyNarratorSummary.id ? { ...s, name: "Renamed" } : s));
    await user.clear(name);
    await user.paste("  Renamed ");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContainEqual({
      method: "PATCH",
      url: `/api/book-narrators/${emptyNarratorSummary.id}`,
      body: { name: "Renamed" },
    });
    expect(await screen.findByRole("heading", { name: /^Renamed/ })).toBeInTheDocument();
    expect(calls.filter((x) => x.url === "/api/book-narrators.summaries")).toHaveLength(2);
  });

  it("rejects an empty name and sends nothing", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<BookNarratorsView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    expect(within(dialog).getByText("Required")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(calls.some((x) => x.method === "PATCH")).toBe(false);
  });

  const takenBody = { error: "name_taken", existingId: scottBrick.id, existingName: scottBrick.name };

  it("offers to merge when the name is taken and merges on confirm", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...base(),
      "PATCH /api/book-narrators/:id": () => jsonResponse(takenBody, 409),
      "POST /api/book-narrators/:id/merge": () => jsonResponse(scottBrick),
    });
    renderWithProviders(<BookNarratorsView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("scott brick");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    const choice = await screen.findByText(/already exists/);
    expect(choice).toHaveTextContent('A narrator named "Scott Brick" already exists. Merge "Émile Zola" into it?');
    await user.click(screen.getByRole("button", { name: "Merge" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContainEqual({
      method: "POST",
      url: `/api/book-narrators/${emptyNarratorSummary.id}/merge`,
      body: { targetId: scottBrick.id },
    });
    expect(calls.filter((x) => x.url === "/api/book-narrators.summaries")).toHaveLength(2);
  });

  it("shows an error in the dialog when the merge fails", async () => {
    const user = userEvent.setup();
    mockApi({
      ...base(),
      "PATCH /api/book-narrators/:id": () => jsonResponse(takenBody, 409),
      "POST /api/book-narrators/:id/merge": () => jsonResponse({ error: "internal_error" }, 500),
    });
    renderWithProviders(<BookNarratorsView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("scott brick");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Merge" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Saving failed.");
  });

  it("collapses the merged-away narrator and requests none of its books afterwards", async () => {
    const user = userEvent.setup();
    let summaries = narratorSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      [VANCE_BOOKS]: () => jsonResponse(vanceBooks),
      "PATCH /api/book-narrators/:id": () =>
        jsonResponse({ error: "name_taken", existingId: scottBrick.id, existingName: scottBrick.name }, 409),
      "POST /api/book-narrators/:id/merge": () => jsonResponse(scottBrick),
    });
    renderWithProviders(<BookNarratorsView />);
    await user.click(await screen.findByRole("button", { name: /^Simon Vance/ }));
    await user.click(await screen.findByRole("button", { name: "Rename narrator Simon Vance" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename narrator" });
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("scott brick");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    summaries = summaries.filter((x) => x.id !== simonVance.id);
    await user.click(await screen.findByRole("button", { name: "Merge" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: /^Simon Vance/ })).not.toBeInTheDocument());
    expect(calls.filter((c) => c.url === `/api/book-narrators/${simonVance.id}/books`)).toHaveLength(1);
  });

  it("returns to the rename dialog with the typed name on Choose another name", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), "PATCH /api/book-narrators/:id": () => jsonResponse(takenBody, 409) });
    renderWithProviders(<BookNarratorsView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("scott brick");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Choose another name" }));

    await waitFor(() => expect(screen.queryByText(/already exists/)).not.toBeInTheDocument());
    const again = await screen.findByRole("dialog", { name: "Rename narrator" });
    expect(within(again).getByRole("textbox", { name: "Name" })).toHaveValue("scott brick");
    expect(calls.some((x) => x.method === "POST")).toBe(false);
  });

  it("shows an error in the dialog when the rename fails", async () => {
    const user = userEvent.setup();
    mockApi({ ...base(), "PATCH /api/book-narrators/:id": () => jsonResponse({ error: "internal_error" }, 500) });
    renderWithProviders(<BookNarratorsView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("Renamed");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Saving failed.");
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Renamed");
  });

  it("opens the detail dialog from a card", async () => {
    const user = userEvent.setup();
    mockApi({ ...base(), [VANCE_BOOKS]: () => jsonResponse(vanceBooks) });
    renderWithProviders(<BookNarratorsView />);
    await user.click(await screen.findByRole("button", { name: /Simon Vance/ }));
    await user.click(await screen.findByRole("button", { name: /Dune Messiah/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Dune Messiah" })).toBeInTheDocument();
  });

  it("reloads the summaries and the open section after a save", async () => {
    const user = userEvent.setup();
    let books = vanceBooks;
    const calls = mockApi({
      ...base(),
      ...noTitleSuggestions("books"),
      [VANCE_BOOKS]: () => jsonResponse(books),
      "PATCH /api/books/:id": (call) => jsonResponse({ ...vanceBooks[1], title: "Renamed", ...(call.body as object) }),
    });
    renderWithProviders(<BookNarratorsView />);
    await user.click(await screen.findByRole("button", { name: /Simon Vance/ }));
    await user.click(await screen.findByRole("button", { name: /Dune Messiah/ }));
    const dialog = await screen.findByRole("dialog");
    expect(cardTitles()).toEqual(["Dune", "Dune Messiah"]);
    books = [vanceBooks[1], vanceBooks[0]];
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.clear(title);
    await user.paste("Renamed");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await flushAsync();
    // The old cards stay visible while the section reloads.
    expect(screen.getAllByRole("heading", { level: 3, hidden: true }).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(calls.filter((c) => c.url === "/api/book-narrators.summaries")).toHaveLength(2);
      expect(calls.filter((c) => c.url === `/api/book-narrators/${simonVance.id}/books`)).toHaveLength(2);
    });
    await waitFor(() => expect(cardTitles()).toEqual(["Dune Messiah", "Dune"]));
  });

  it("closes the dialog and reloads the summaries and the open section after a delete", async () => {
    const user = userEvent.setup();
    let books = vanceBooks;
    let summaries = narratorSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      [VANCE_BOOKS]: () => jsonResponse(books),
      "DELETE /api/books/:id": () => noContent(),
    });
    renderWithProviders(<BookNarratorsView />);
    await user.click(await screen.findByRole("button", { name: /Simon Vance/ }));
    await user.click(await screen.findByRole("button", { name: /Dune Messiah/ }));
    const dialog = await screen.findByRole("dialog");
    books = vanceBooks.slice(0, 1);
    summaries = narratorSummaries.map((s) => (s.id === simonVance.id ? { ...s, bookCount: 1 } : s));
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Dune Messiah"?');
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContainEqual({ method: "DELETE", url: `/api/books/${vanceBooks[1].id}`, body: undefined });
    await waitFor(() => {
      expect(calls.filter((c) => c.url === "/api/book-narrators.summaries")).toHaveLength(2);
      expect(calls.filter((c) => c.url === `/api/book-narrators/${simonVance.id}/books`)).toHaveLength(2);
    });
    expect(await screen.findByRole("heading", { name: /^Simon Vance/ })).toHaveTextContent("Simon Vance1 book");
    await waitFor(() => expect(cardTitles()).toEqual(["Dune"]));
  });

  it("shows an error with retry when the summaries fail", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      ...base(),
      [SUMMARIES]: () => (fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse([simonVanceSummary])),
    });
    renderWithProviders(<BookNarratorsView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: /^Simon Vance/ })).toBeInTheDocument();
  });
});
