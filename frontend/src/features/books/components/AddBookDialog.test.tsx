import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BookAuthorResponse, BookNarratorResponse, BookSeriesResponse } from "../../../types/api";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { bookTypes, hardcover, herbert } from "../../../test/fixtures/books";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { AddBookDialog } from "./AddBookDialog";

const noTitleSuggestions = { "GET /api/books/title-suggestions": () => jsonResponse({ suggestions: [] }) };

async function fillTitleAndYear(dialog: HTMLElement, user: ReturnType<typeof userEvent.setup>) {
  // user.paste avoids per-keystroke user.type, which is ~10x slower and hit the CI timeout.
  await user.click(within(dialog).getByRole("combobox", { name: /title/i }));
  await user.paste("Dune");
  await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
  await user.click(screen.getByRole("option", { name: "2020" }));
}

describe("AddBookDialog", () => {
  it("renders nothing while closed", () => {
    mockApi({});
    renderWithProviders(<AddBookDialog open={false} onClose={() => {}} onCreated={() => {}} types={bookTypes} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("posts the filled form and reports the created book", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const calls = mockApi({
      ...noTitleSuggestions,
      "POST /api/books": (call) => jsonResponse({ id: "new-id", ...(call.body as object) }, 201),
    });
    renderWithProviders(<AddBookDialog open onClose={() => {}} onCreated={onCreated} types={bookTypes} />);
    const dialog = screen.getByRole("dialog", { name: "Add book" });
    expect(within(dialog).queryByRole("heading", { name: "Add book" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await fillTitleAndYear(dialog, user);
    expect(save).toBeEnabled(); // description, types, authors and cover are optional

    await user.click(within(dialog).getByRole("combobox", { name: /types/i }));
    await user.click(screen.getByRole("option", { name: "Hardcover" }));
    await user.keyboard("{Escape}");
    await user.click(within(dialog).getByRole("textbox", { name: /description/i }));
    await user.paste("Spice.");
    await user.click(within(dialog).getByRole("textbox", { name: /cover image url/i }));
    await user.paste("https://img.example/d.png");
    expect(within(dialog).getByRole("img", { name: "Cover preview" })).toHaveAttribute(
      "src",
      "https://img.example/d.png",
    );
    await user.click(within(dialog).getByRole("button", { name: "Owned" }));
    await user.click(within(dialog).getByRole("button", { name: "Reading" }));

    await user.click(save);
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(calls.filter((c) => c.method === "POST")).toEqual([
      {
        method: "POST",
        url: "/api/books",
        body: {
          title: "Dune",
          releaseYear: 2020,
          releaseDate: null,
          description: "Spice.",
          coverImageUrl: "https://img.example/d.png",
          ownership: "owned",
          progress: "reading",
          typeIds: [hardcover.id],
        },
      },
    ]);
    expect(onCreated.mock.calls[0][0]).toMatchObject({ id: "new-id", title: "Dune" });
  });

  it("creates a pending author before creating the book, and sends both ids", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const created: BookAuthorResponse = { id: "author-new", name: "New Author" };
    const calls = mockApi({
      ...noTitleSuggestions,
      "POST /api/books": (call) => jsonResponse({ id: "new-id", ...(call.body as object) }, 201),
      "POST /api/book-authors": () => jsonResponse(created, 201),
      "GET /api/book-authors": () => jsonResponse([herbert]),
    });
    renderWithProviders(<AddBookDialog open onClose={() => {}} onCreated={onCreated} types={bookTypes} />);
    const dialog = screen.getByRole("dialog");
    await fillTitleAndYear(dialog, user);

    const authorsField = within(dialog).getByRole("combobox", { name: /authors/i });
    await user.click(authorsField);
    await user.paste("New Author");
    await user.keyboard("{Enter}");
    await user.click(authorsField);
    await user.paste("herbert");
    await user.click(await screen.findByRole("option", { name: "Frank Herbert" }));

    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());

    const authorPost = calls.find((c) => c.url === "/api/book-authors" && c.method === "POST");
    const bookPost = calls.find((c) => c.url === "/api/books" && c.method === "POST");
    expect(calls.indexOf(authorPost!)).toBeLessThan(calls.indexOf(bookPost!));
    expect(authorPost!.body).toEqual({ name: "New Author" });
    expect(bookPost!.body).toMatchObject({ authorIds: [created.id, herbert.id] });
  });

  it("creates a pending narrator and series before creating the book, sending ids and the position", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const narrator: BookNarratorResponse = { id: "narrator-new", name: "New Narrator" };
    const series: BookSeriesResponse = { id: "series-new", name: "New Series" };
    const calls = mockApi({
      ...noTitleSuggestions,
      "POST /api/books": (call) => jsonResponse({ id: "new-id", ...(call.body as object) }, 201),
      "POST /api/book-narrators": () => jsonResponse(narrator, 201),
      "GET /api/book-narrators": () => jsonResponse([]),
      "POST /api/book-series": () => jsonResponse(series, 201),
      "GET /api/book-series": () => jsonResponse([]),
    });
    renderWithProviders(<AddBookDialog open onClose={() => {}} onCreated={onCreated} types={bookTypes} />);
    const dialog = screen.getByRole("dialog");
    await fillTitleAndYear(dialog, user);

    await user.click(within(dialog).getByRole("combobox", { name: /narrators/i }));
    await user.paste("New Narrator");
    await user.keyboard("{Enter}");
    await user.click(within(dialog).getByRole("combobox", { name: /series/i }));
    await user.paste("New Series");
    await user.keyboard("{Enter}");
    await user.click(within(dialog).getByRole("textbox", { name: "No. New Series" }));
    await user.paste("1,5");

    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());

    const bookPost = calls.find((c) => c.url === "/api/books" && c.method === "POST");
    const seriesPost = calls.find((c) => c.url === "/api/book-series" && c.method === "POST");
    const narratorPost = calls.find((c) => c.url === "/api/book-narrators" && c.method === "POST");
    expect(calls.indexOf(seriesPost!)).toBeLessThan(calls.indexOf(bookPost!));
    expect(calls.indexOf(narratorPost!)).toBeLessThan(calls.indexOf(bookPost!));
    expect(bookPost!.body).toMatchObject({
      narratorIds: [narrator.id],
      series: [{ seriesId: series.id, position: 1.5 }],
    });
  });

  it("blocks saving while a series position is invalid", async () => {
    const user = userEvent.setup();
    mockApi({ ...noTitleSuggestions, "GET /api/book-series": () => jsonResponse([]) });
    renderWithProviders(<AddBookDialog open onClose={() => {}} onCreated={() => {}} types={bookTypes} />);
    const dialog = screen.getByRole("dialog");
    await fillTitleAndYear(dialog, user);

    await user.click(within(dialog).getByRole("combobox", { name: /series/i }));
    await user.paste("Mistborn");
    await user.keyboard("{Enter}");
    await user.click(within(dialog).getByRole("textbox", { name: "No. Mistborn" }));
    await user.paste("abc");
    await user.tab();

    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(within(dialog).getByText(/Must be a number from 0 to 9999.99/)).toBeInTheDocument();
  });

  it("shows the error and does not create the book when creating an author fails", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const calls = mockApi({
      ...noTitleSuggestions,
      "POST /api/books": (call) => jsonResponse({ id: "new-id", ...(call.body as object) }, 201),
      "POST /api/book-authors": () => jsonResponse({ error: "internal_error" }, 500),
      "GET /api/book-authors": () => jsonResponse([]),
    });
    renderWithProviders(<AddBookDialog open onClose={() => {}} onCreated={onCreated} types={bookTypes} />);
    const dialog = screen.getByRole("dialog");
    await fillTitleAndYear(dialog, user);

    await user.click(within(dialog).getByRole("combobox", { name: /authors/i }));
    await user.paste("New Author");
    await user.keyboard("{Enter}");
    const save = within(dialog).getByRole("button", { name: "Save" });
    await user.click(save);

    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(calls.some((c) => c.url === "/api/books" && c.method === "POST")).toBe(false);
    expect(save).toBeEnabled();
  });

  it("shows the backend error and stays open when creating fails", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    mockApi({
      ...noTitleSuggestions,
      "POST /api/books": () => jsonResponse({ error: "validation_error", message: "title: nope" }, 400),
    });
    renderWithProviders(<AddBookDialog open onClose={() => {}} onCreated={onCreated} types={bookTypes} />);
    const dialog = screen.getByRole("dialog");
    await fillTitleAndYear(dialog, user);

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("title: nope");
    expect(onCreated).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("resets when reopened", async () => {
    mockApi({});
    const { rerender } = renderWithProviders(
      <AddBookDialog open onClose={() => {}} onCreated={() => {}} types={bookTypes} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Dune");
    expect(screen.getByRole("combobox", { name: /title/i })).toHaveValue("Dune");

    rerender(<AddBookDialog open={false} onClose={() => {}} onCreated={() => {}} types={bookTypes} />);
    rerender(<AddBookDialog open onClose={() => {}} onCreated={() => {}} types={bookTypes} />);

    expect(screen.getByRole("combobox", { name: /title/i })).toHaveValue("");
  });
});
