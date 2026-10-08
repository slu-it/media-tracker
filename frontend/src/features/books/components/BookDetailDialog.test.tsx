import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BookResponse, BookAuthorResponse, BookSeriesResponse } from "../../../types/api";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi, noContent } from "../../../test/mockFetch";
import { bookTypes, dune, duneSaga, herbert, kindle, paperback } from "../../../test/fixtures/books";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { BookDetailDialog } from "./BookDetailDialog";

const book: BookResponse = { ...dune, description: "Spice, sand and worms." };

function renderDialog(
  props: Partial<{
    book: BookResponse;
    onClose: () => void;
    onSaved: (updated: BookResponse) => void;
    onDeleted: (id: string) => void;
  }> = {},
) {
  return renderWithProviders(
    <BookDetailDialog
      book={props.book ?? book}
      onClose={props.onClose ?? (() => {})}
      onSaved={props.onSaved ?? (() => {})}
      onDeleted={props.onDeleted ?? (() => {})}
      types={bookTypes}
    />,
  );
}

/** Mirrors the host: the saved book replaces the `book` prop. */
function StatefulDialog({ initial, onSaved }: { initial: BookResponse; onSaved?: (updated: BookResponse) => void }) {
  const [current, setCurrent] = useState(initial);
  return (
    <BookDetailDialog
      book={current}
      onClose={() => {}}
      onSaved={(updated) => {
        setCurrent(updated);
        onSaved?.(updated);
      }}
      onDeleted={() => {}}
      types={bookTypes}
    />
  );
}

const patches = (calls: { method: string }[]) => calls.filter((c) => c.method === "PATCH");

describe("BookDetailDialog", () => {
  it("renders nothing without a book", () => {
    renderWithProviders(
      <BookDetailDialog book={null} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} types={bookTypes} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the cover, description, types and authors in view mode, labelled with the title", () => {
    mockApi({});
    renderDialog();
    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveAccessibleName("Dune");
    expect(within(dialog).getByRole("img", { name: "Dune" })).toHaveAttribute("src", book.coverImageUrl);
    expect(within(dialog).getByText("Spice, sand and worms.")).toBeInTheDocument();
    expect(within(dialog).getByText("Hardcover")).toBeInTheDocument();
    expect(within(dialog).getByText("Kindle")).toBeInTheDocument();
    expect(within(dialog).getByText("Frank Herbert")).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: "Owned" })).toBeInTheDocument();
  });

  it("edits and saves only the changed fields, then returns to view mode", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const calls = mockApi({
      "PATCH /api/books/:id": (call) => jsonResponse({ ...book, ...(call.body as object) }),
    });
    renderDialog({ onSaved });
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Edit book" })).toBe(dialog);
    expect(within(dialog).queryByRole("heading", { name: "Edit book" })).not.toBeInTheDocument();
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled(); // nothing changed yet

    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.clear(title);
    await user.paste("Dune Messiah");
    await user.clear(within(dialog).getByRole("textbox", { name: /cover image url/i }));
    expect(save).toBeEnabled();

    await user.click(save);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(calls.filter((c) => c.method === "PATCH")).toEqual([
      { method: "PATCH", url: "/api/books/book-1", body: { title: "Dune Messiah", coverImageUrl: null } },
    ]);
    expect(onSaved.mock.calls[0][0]).toMatchObject({ title: "Dune Messiah", coverImageUrl: null });
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("sends only the changed progress when editing solely the progress field", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "PATCH /api/books/:id": (call) => jsonResponse({ ...book, ...(call.body as object) }),
    });
    renderDialog();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.click(
      within(within(dialog).getByRole("group", { name: "Progress" })).getByRole("button", { name: "Finished" }),
    );
    expect(patches(calls)).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]).toMatchObject({ body: { progress: "finished" } });
  });

  it("sends typeIds when the type selection changes and omits them when unchanged", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "PATCH /api/books/:id": (call) => jsonResponse({ ...book, ...(call.body as object) }),
    });
    renderDialog();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.click(within(dialog).getByRole("combobox", { name: /types/i }));
    await user.click(screen.getByRole("option", { name: "Paperback" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]).toMatchObject({ body: { typeIds: [dune.types[0].id, kindle.id, paperback.id] } });
  });

  it("creates a pending author before saving and sends its id in authorIds", async () => {
    const user = userEvent.setup();
    const created: BookAuthorResponse = { id: "author-new", name: "Brian Herbert" };
    const calls = mockApi({
      "GET /api/book-authors": () => jsonResponse([]),
      "POST /api/book-authors": () => jsonResponse(created, 201),
      "PATCH /api/books/:id": (call) => jsonResponse({ ...book, ...(call.body as object) }),
    });
    renderDialog();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    const authorsField = within(dialog).getByRole("combobox", { name: /authors/i });
    await user.click(authorsField);
    await user.paste("Brian Herbert");
    await user.keyboard("{Enter}");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    const authorPost = calls.find((c) => c.url === "/api/book-authors" && c.method === "POST");
    expect(authorPost?.body).toEqual({ name: "Brian Herbert" });
    expect(calls.indexOf(authorPost!)).toBeLessThan(calls.indexOf(patches(calls)[0] as (typeof calls)[number]));
    expect(patches(calls)[0]).toMatchObject({ body: { authorIds: [herbert.id, created.id] } });
  });

  it("creates a pending series before saving and sends the full series list", async () => {
    const user = userEvent.setup();
    const created: BookSeriesResponse = { id: "series-new", name: "Cosmere" };
    const inSeries: BookResponse = { ...book, series: [{ id: duneSaga.id, name: duneSaga.name, position: 1 }] };
    const calls = mockApi({
      "GET /api/book-series": () => jsonResponse([]),
      "POST /api/book-series": () => jsonResponse(created, 201),
      "PATCH /api/books/:id": (call) => jsonResponse({ ...inSeries, ...(call.body as object), series: [] }),
    });
    renderDialog({ book: inSeries });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Dune Saga #1")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    expect(within(dialog).getByRole("textbox", { name: "No. Dune Saga" })).toHaveValue("1");
    await user.click(within(dialog).getByRole("combobox", { name: /series/i }));
    await user.paste("Cosmere");
    await user.keyboard("{Enter}");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    const seriesPost = calls.find((c) => c.url === "/api/book-series" && c.method === "POST");
    expect(seriesPost?.body).toEqual({ name: "Cosmere" });
    expect(calls.indexOf(seriesPost!)).toBeLessThan(calls.indexOf(patches(calls)[0] as (typeof calls)[number]));
    expect(patches(calls)[0]).toMatchObject({
      body: {
        series: [
          { seriesId: duneSaga.id, position: 1 },
          { seriesId: created.id, position: null },
        ],
      },
    });
  });

  it("shows an error and sends no PATCH when creating a pending author fails", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/book-authors": () => jsonResponse([]),
      "POST /api/book-authors": () => jsonResponse({ error: "internal_error" }, 500),
      "PATCH /api/books/:id": (call) => jsonResponse({ ...book, ...(call.body as object) }),
    });
    renderDialog();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.click(within(dialog).getByRole("combobox", { name: /authors/i }));
    await user.paste("Brian Herbert");
    await user.keyboard("{Enter}");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    expect(patches(calls)).toEqual([]);
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("clears the description when emptied", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "PATCH /api/books/:id": (call) => jsonResponse({ ...book, ...(call.body as object) }),
    });
    renderDialog();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.clear(within(dialog).getByRole("textbox", { name: /description/i }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]).toMatchObject({ body: { description: null } });
  });

  it("keeps the save button disabled while the draft is invalid and shows backend errors", async () => {
    const user = userEvent.setup();
    mockApi({
      "PATCH /api/books/:id": () => jsonResponse({ error: "validation_error", message: "title: nope" }, 400),
    });
    renderDialog();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.clear(title);
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();

    await user.type(title, "X");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("title: nope");
    expect(within(dialog).getByRole("textbox", { name: /title/i })).toBeInTheDocument(); // still editing
  });

  it("disables save while a picked release date is invalid, and re-enables after cancel and re-edit", async () => {
    const user = userEvent.setup();
    const calls = mockApi({});
    renderDialog();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const save = within(dialog).getByRole("button", { name: "Save" });

    // ArrowUp fills an empty section with a default, giving a full valid date without typing multi-digit sections.
    const releaseDate = within(dialog).getByRole("group", { name: "Release date" });
    await user.click(within(releaseDate).getByRole("spinbutton", { name: "Year" }));
    await user.keyboard("{ArrowUp}{ArrowRight}{ArrowUp}{ArrowRight}{ArrowUp}");
    expect(save).toBeEnabled();

    await user.click(within(releaseDate).getByRole("spinbutton", { name: "Year" }));
    await user.keyboard("0");
    expect(save).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();

    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.clear(title);
    await user.paste("Dune (changed)");
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeEnabled();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("asks for confirmation before deleting, in view and in edit mode", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const calls = mockApi({ "DELETE /api/books/:id": () => noContent() });
    renderDialog({ onDeleted });
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Dune"?');
    // Selects the last-mounted (topmost) portal: the confirm dialog stacked over the detail dialog.
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "No" }));
    await waitFor(() => expect(screen.queryByText('Delete "Dune"?')).not.toBeInTheDocument());
    expect(calls.filter((c) => c.method === "DELETE")).toEqual([]);
    expect(onDeleted).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Dune"?');
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledExactlyOnceWith("book-1"));
    expect(calls.filter((c) => c.method === "DELETE")).toEqual([
      { method: "DELETE", url: "/api/books/book-1", body: undefined },
    ]);
  });

  it("shows the error and stays open when deleting fails", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    mockApi({ "DELETE /api/books/:id": () => jsonResponse({ error: "internal_error" }, 500) });
    renderDialog({ onDeleted });
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Dune"?');
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));

    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  it("cancel discards the edits and returns to view mode", async () => {
    const user = userEvent.setup();
    const calls = mockApi({});
    renderDialog();
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.clear(title);
    await user.paste("Dune (changed)");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Dune")).toBeInTheDocument();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("closes without saving", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const calls = mockApi({});
    renderDialog({ onClose });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByRole("textbox", { name: /title/i }), "!");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  describe("quick progress toggle", () => {
    const paused: BookResponse = { ...book, progress: "paused" };

    it("PATCHes only the progress on click and stays in view mode", async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      const calls = mockApi({
        "PATCH /api/books/:id": (call) => jsonResponse({ ...paused, ...(call.body as object) }),
      });
      renderDialog({ book: paused, onSaved });
      const dialog = screen.getByRole("dialog");

      await user.click(within(dialog).getByRole("button", { name: "Reading" }));
      await flushAsync();

      expect(patches(calls)).toEqual([{ method: "PATCH", url: "/api/books/book-1", body: { progress: "reading" } }]);
      expect(onSaved).toHaveBeenCalledOnce();
      expect(onSaved.mock.calls[0][0]).toMatchObject({ progress: "reading" });
      expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("shows the error and reverts the pressed button on a failed save", async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      mockApi({
        "PATCH /api/books/:id": () => jsonResponse({ error: "validation_error", message: "progress: nope" }, 400),
      });
      renderDialog({ book: paused, onSaved });
      const dialog = screen.getByRole("dialog");

      await user.click(within(dialog).getByRole("button", { name: "Reading" }));
      await flushAsync();

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("progress: nope");
      expect(onSaved).not.toHaveBeenCalled();
      expect(within(dialog).getByRole("button", { name: "Paused" })).toHaveAttribute("aria-pressed", "true");
      expect(within(dialog).getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "false");
    });

    it("blocks further changes and actions while the progress save is pending", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const onSaved = vi.fn();
      let resolvePatch!: (response: Response) => void;
      const calls = mockApi({
        "PATCH /api/books/:id": () =>
          new Promise<Response>((resolve) => {
            resolvePatch = resolve;
          }),
      });
      renderDialog({ book: paused, onSaved });
      const dialog = screen.getByRole("dialog");

      await user.click(within(dialog).getByRole("button", { name: "Reading" }));

      expect(within(dialog).getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true");
      expect(within(dialog).getByRole("group", { name: "Progress" })).toHaveAttribute("aria-busy", "true");
      await user.click(within(dialog).getByRole("button", { name: "Finished" }));
      expect(patches(calls)).toHaveLength(1);
      expect(within(dialog).getByRole("button", { name: "Edit" })).toBeDisabled();
      expect(within(dialog).getByRole("button", { name: "Delete" })).toBeDisabled();

      resolvePatch(jsonResponse({ ...paused, progress: "reading" }));
      await flushAsync();

      expect(within(dialog).getByRole("group", { name: "Progress" })).not.toHaveAttribute("aria-busy");
      expect(onSaved).toHaveBeenCalledOnce();
    });

    it("only updates the draft in edit mode and sends nothing before Save", async () => {
      const user = userEvent.setup();
      const calls = mockApi({});
      renderDialog({ book: paused });
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Edit" }));

      const group = within(dialog).getByRole("group", { name: "Progress" });
      await user.click(within(group).getByRole("button", { name: "Reading" }));

      expect(within(group).getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true");
      expect(patches(calls)).toEqual([]);
    });
  });

  describe("quick ownership toggle", () => {
    const watchlisted: BookResponse = { ...book, ownership: "watchlist" };
    const ownedButton = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: "Owned" });

    it("PATCHes only the ownership on click and stays in view mode", async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      const calls = mockApi({
        "PATCH /api/books/:id": (call) => jsonResponse({ ...watchlisted, ...(call.body as object) }),
      });
      renderDialog({ book: watchlisted, onSaved });
      const dialog = screen.getByRole("dialog");
      expect(ownedButton(dialog)).toHaveAttribute("aria-pressed", "false");

      await user.click(ownedButton(dialog));
      await flushAsync();

      expect(patches(calls)).toEqual([{ method: "PATCH", url: "/api/books/book-1", body: { ownership: "owned" } }]);
      expect(onSaved).toHaveBeenCalledOnce();
      expect(onSaved.mock.calls[0][0]).toMatchObject({ ownership: "owned" });
      expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("shows the error and reverts the toggle on a failed save", async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      mockApi({
        "PATCH /api/books/:id": () => jsonResponse({ error: "validation_error", message: "ownership: nope" }, 400),
      });
      renderDialog({ book: watchlisted, onSaved });
      const dialog = screen.getByRole("dialog");

      await user.click(ownedButton(dialog));
      await flushAsync();

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("ownership: nope");
      expect(onSaved).not.toHaveBeenCalled();
      expect(ownedButton(dialog)).toHaveAttribute("aria-pressed", "false");
    });

    it("is blocked while any quick save is pending", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      let resolvePatch!: (response: Response) => void;
      const calls = mockApi({
        "PATCH /api/books/:id": () =>
          new Promise<Response>((resolve) => {
            resolvePatch = resolve;
          }),
      });
      renderWithProviders(<StatefulDialog initial={watchlisted} />);
      const dialog = screen.getByRole("dialog");
      const ownershipGroup = within(dialog).getByRole("group", { name: "Ownership" });

      // A pending progress save blocks the toggle.
      await user.click(within(dialog).getByRole("button", { name: "Finished" }));
      expect(ownershipGroup).toHaveAttribute("aria-busy", "true");
      await user.click(ownedButton(dialog));
      expect(patches(calls)).toHaveLength(1);
      resolvePatch(jsonResponse({ ...watchlisted, progress: "finished" }));
      await flushAsync();
      expect(ownershipGroup).not.toHaveAttribute("aria-busy");

      // A pending ownership save blocks a second change and the other controls.
      await user.click(ownedButton(dialog));
      expect(ownedButton(dialog)).toHaveAttribute("aria-pressed", "true");
      expect(ownershipGroup).toHaveAttribute("aria-busy", "true");
      await user.click(within(dialog).getByRole("button", { name: "Paused" }));
      expect(patches(calls)).toHaveLength(2);
      resolvePatch(jsonResponse({ ...watchlisted, progress: "finished", ownership: "owned" }));
      await flushAsync();
      expect(ownershipGroup).not.toHaveAttribute("aria-busy");
    });

    it("only changes the draft in edit mode and Save sends the ownership", async () => {
      const user = userEvent.setup();
      const calls = mockApi({
        "PATCH /api/books/:id": (call) => jsonResponse({ ...watchlisted, ...(call.body as object) }),
      });
      renderDialog({ book: watchlisted });
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Edit" }));

      await user.click(ownedButton(dialog));
      expect(ownedButton(dialog)).toHaveAttribute("aria-pressed", "true");
      expect(patches(calls)).toEqual([]);

      await user.click(within(dialog).getByRole("button", { name: "Save" }));
      await flushAsync();
      expect(patches(calls)).toEqual([{ method: "PATCH", url: "/api/books/book-1", body: { ownership: "owned" } }]);
    });
  });
});
