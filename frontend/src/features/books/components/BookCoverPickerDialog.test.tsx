import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { duneAudiobookCoverOptions, duneCoverOptions } from "../../../test/fixtures/books";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import type { BookCoverSource } from "../../../types/api";
import { BookCoverPickerDialog } from "./BookCoverPickerDialog";

const respond = (_call: unknown, url: URL) =>
  jsonResponse(url.searchParams.get("source") === "audiobook" ? duneAudiobookCoverOptions : duneCoverOptions);

function renderPicker(defaultSource: BookCoverSource, onPick: (url: string) => void = () => {}) {
  return renderWithProviders(
    <BookCoverPickerDialog
      open
      onClose={() => {}}
      initialQuery="Dune"
      releaseYear={1965}
      currentCoverUrl={null}
      defaultSource={defaultSource}
      onPick={onPick}
    />,
  );
}

describe("BookCoverPickerDialog", () => {
  it("starts on the book source without a source parameter and offers a match select", async () => {
    const calls = mockApi({ "GET /api/books/cover-options": respond });
    renderPicker("book");

    expect(await screen.findByRole("combobox", { name: "Matching book" })).toBeInTheDocument();
    expect(calls[0].url).toBe("/api/books/cover-options?query=Dune&releaseYear=1965");
    expect(screen.getByRole("button", { name: "Book" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Covers from Open Library")).toBeInTheDocument();
  });

  it("starts on the audiobook source when told to, without a match select", async () => {
    const calls = mockApi({ "GET /api/books/cover-options": respond });
    renderPicker("audiobook");

    await screen.findByRole("button", { name: "Use cover 1" });
    expect(calls[0].url).toBe("/api/books/cover-options?query=Dune&releaseYear=1965&source=audiobook");
    expect(screen.getByRole("button", { name: "Audiobook" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("combobox", { name: "Matching book" })).not.toBeInTheDocument();
    expect(screen.getByText("Covers from Audible")).toBeInTheDocument();
  });

  it("refetches with the other source when the toggle changes", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "GET /api/books/cover-options": respond });
    renderPicker("book");
    await screen.findByRole("combobox", { name: "Matching book" });

    await user.click(screen.getByRole("button", { name: "Audiobook" }));

    await waitFor(() => expect(calls.some((c) => c.url.includes("source=audiobook"))).toBe(true));
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Matching book" })).not.toBeInTheDocument());
    expect(await screen.findByText("Covers from Audible")).toBeInTheDocument();
  });

  it("drops a picked match when the source switches to audiobook", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "GET /api/books/cover-options": respond });
    renderPicker("book");
    await user.click(await screen.findByRole("combobox", { name: "Matching book" }));
    await user.click(await screen.findByRole("option", { name: /Dune Messiah/ }));
    await waitFor(() => expect(calls.some((c) => c.url.includes("match=OL2W"))).toBe(true));

    await user.click(screen.getByRole("button", { name: "Audiobook" }));

    await waitFor(() => expect(calls.some((c) => c.url.includes("source=audiobook"))).toBe(true));
    expect(calls.filter((c) => c.url.includes("source=audiobook")).every((c) => !c.url.includes("match="))).toBe(true);
  });

  it("reports the full-size URL of the picked cover", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    mockApi({ "GET /api/books/cover-options": respond });
    renderPicker("book", onPick);

    await user.click(await screen.findByRole("button", { name: "Use cover 2" }));

    await waitFor(() => expect(onPick).toHaveBeenCalledExactlyOnceWith(duneCoverOptions.covers.items[1].imageUrl));
  });
});
