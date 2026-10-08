import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BookResponse } from "../../../types/api";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { bookTypes, dune } from "../../../test/fixtures/books";
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
});
