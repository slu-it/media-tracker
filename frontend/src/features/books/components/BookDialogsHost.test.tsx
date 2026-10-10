import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BookResponse } from "../../../types/api";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi, noTitleSuggestions } from "../../../test/mockFetch";
import { bookTypes, dune, hardcover, kindle } from "../../../test/fixtures/books";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { BookDialogsHost } from "./BookDialogsHost";

function Harness({ onUpdated }: { onUpdated: (book: BookResponse) => void }) {
  const [selected, setSelected] = useState<BookResponse | null>(dune);
  return (
    <BookDialogsHost
      selected={selected}
      onSelect={setSelected}
      onCreated={() => {}}
      onUpdated={onUpdated}
      onDeleted={() => {}}
    />
  );
}

describe("BookDialogsHost", () => {
  it("keeps the dialog closed but still updates the list when a save resolves after closing", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    let resolvePatch!: (response: Response) => void;
    mockApi({
      "GET /api/book-types": () => jsonResponse(bookTypes),
      "PATCH /api/books/:id": () =>
        new Promise<Response>((resolve) => {
          resolvePatch = resolve;
        }),
    });
    renderWithProviders(<Harness onUpdated={onUpdated} />);
    await flushAsync();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finished" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    resolvePatch(jsonResponse({ ...dune, progress: "finished" }));
    await flushAsync();

    expect(onUpdated).toHaveBeenCalledOnce();
    expect(onUpdated.mock.calls[0][0]).toMatchObject({ id: dune.id, progress: "finished" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("enables the add FAB once the types are loaded and opens the add dialog", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/book-types": () => jsonResponse(bookTypes) });
    renderWithProviders(
      <BookDialogsHost
        selected={null}
        onSelect={() => {}}
        onCreated={() => {}}
        onUpdated={() => {}}
        onDeleted={() => {}}
      />,
    );
    const fab = screen.getByRole("button", { name: "Add book" });
    expect(fab).toBeDisabled();
    await waitFor(() => expect(fab).toBeEnabled());

    await user.click(fab);
    expect(await screen.findByRole("dialog", { name: "Add book" })).toBeInTheDocument();
  });

  it("opens the add dialog with the chosen preset type preselected and saves it", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/book-types": () => jsonResponse(bookTypes),
      ...noTitleSuggestions("books"),
      "POST /api/books": (call) => jsonResponse({ id: "new-id", ...(call.body as object) }, 201),
    });
    renderWithProviders(
      <BookDialogsHost
        selected={null}
        onSelect={() => {}}
        onCreated={() => {}}
        onUpdated={() => {}}
        onDeleted={() => {}}
        typeCounts={{ [kindle.id]: 5, [hardcover.id]: 1 }}
      />,
    );
    const fab = screen.getByRole("button", { name: "Add book" });
    await waitFor(() => expect(fab).toBeEnabled());

    await user.hover(fab);
    await waitFor(() => expect(fab).toHaveAttribute("aria-expanded", "true"));
    await user.click(await screen.findByRole("menuitem", { name: "Kindle" }));
    const dialog = await screen.findByRole("dialog", { name: "Add book" });
    expect(within(dialog).getByText("Kindle")).toBeInTheDocument();
    expect(within(dialog).queryByText("Hardcover")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("combobox", { name: /title/i }));
    await user.paste("Dune");
    await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "2020" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({ typeIds: [kindle.id] });
  });

  it("opens the add dialog without a preselected type via the button itself", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/book-types": () => jsonResponse(bookTypes) });
    renderWithProviders(
      <BookDialogsHost
        selected={null}
        onSelect={() => {}}
        onCreated={() => {}}
        onUpdated={() => {}}
        onDeleted={() => {}}
        typeCounts={{ [kindle.id]: 5 }}
      />,
    );
    const fab = screen.getByRole("button", { name: "Add book" });
    await waitFor(() => expect(fab).toBeEnabled());

    await user.click(fab);
    const dialog = await screen.findByRole("dialog", { name: "Add book" });
    expect(within(dialog).queryByText("Kindle")).not.toBeInTheDocument();
  });

  it("does not reopen the speed dial when the add dialog is cancelled", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/book-types": () => jsonResponse(bookTypes) });
    renderWithProviders(
      <BookDialogsHost
        selected={null}
        onSelect={() => {}}
        onCreated={() => {}}
        onUpdated={() => {}}
        onDeleted={() => {}}
      />,
    );
    const fab = screen.getByRole("button", { name: "Add book" });
    await waitFor(() => expect(fab).toBeEnabled());

    await user.click(fab);
    await screen.findByRole("dialog", { name: "Add book" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await flushAsync();
    expect(fab).toHaveAttribute("aria-expanded", "false");
  });
});
