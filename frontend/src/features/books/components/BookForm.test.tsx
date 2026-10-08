import { useState } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { bookTypes, hardcover } from "../../../test/fixtures/books";
import { mockApi } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { emptyBookDraft, type BookDraft } from "../domain/bookDraft";
import { BookForm } from "./BookForm";

function Harness({
  initial,
  onValidityChange,
  onDraft,
}: {
  initial: BookDraft;
  onValidityChange?: (valid: boolean) => void;
  onDraft?: (draft: BookDraft) => void;
}) {
  const [draft, setDraft] = useState<BookDraft>(initial);
  return (
    <BookForm
      value={draft}
      onChange={(next) => {
        setDraft(next);
        onDraft?.(next);
      }}
      types={bookTypes}
      onValidityChange={onValidityChange}
    />
  );
}

describe("BookForm", () => {
  it("shows the fields in order with ownership and progress bars", () => {
    mockApi({});
    renderWithProviders(<Harness initial={emptyBookDraft()} />);

    expect(screen.getByRole("textbox", { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /description/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /types/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /release year/i })).toBeInTheDocument();
    const authors = screen.getByRole("combobox", { name: /authors/i });
    const narrators = screen.getByRole("combobox", { name: /narrators/i });
    const series = screen.getByRole("combobox", { name: /series/i });
    expect(authors.compareDocumentPosition(narrators) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(narrators.compareDocumentPosition(series) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("group", { name: "Ownership" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watchlist" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Not started" })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers years far below the games floor, such as 1965", async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    mockApi({});
    renderWithProviders(<Harness initial={emptyBookDraft()} onDraft={onDraft} />);

    await user.click(screen.getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "1965" }));
    expect(onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ releaseYear: 1965 }));
  });

  it("reports ownership and progress changes through onChange", async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    mockApi({});
    renderWithProviders(<Harness initial={emptyBookDraft()} onDraft={onDraft} />);

    await user.click(screen.getByRole("button", { name: "Owned" }));
    expect(onDraft).toHaveBeenLastCalledWith({ ...emptyBookDraft(), ownership: "owned" });
    await user.click(screen.getByRole("button", { name: "Reading" }));
    expect(onDraft).toHaveBeenLastCalledWith({ ...emptyBookDraft(), ownership: "owned", progress: "reading" });
  });

  it("lets the user pick a type, which is optional", async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    mockApi({});
    renderWithProviders(<Harness initial={emptyBookDraft()} onDraft={onDraft} />);

    await user.click(screen.getByRole("combobox", { name: /types/i }));
    await user.click(screen.getByRole("option", { name: "Hardcover" }));
    expect(onDraft).toHaveBeenLastCalledWith({ ...emptyBookDraft(), typeIds: [hardcover.id] });
  });

  it("disables the release year while a release date is set, and clearing it re-enables the year", async () => {
    const user = userEvent.setup();
    mockApi({});
    renderWithProviders(<Harness initial={{ ...emptyBookDraft(), releaseYear: 1965, releaseDate: "1965-08-01" }} />);

    expect(screen.getByRole("combobox", { name: /release year/i })).toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByRole("combobox", { name: /release year/i })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("reports the release date as invalid while a typed edit is rejected, and valid again once cleared", async () => {
    const user = userEvent.setup();
    const onValidityChange = vi.fn();
    mockApi({});
    renderWithProviders(
      <Harness
        initial={{ ...emptyBookDraft(), releaseYear: 1965, releaseDate: "1965-08-01" }}
        onValidityChange={onValidityChange}
      />,
    );
    const releaseDate = screen.getByRole("group", { name: "Release date" });

    await user.click(within(releaseDate).getByRole("spinbutton", { name: "Year" }));
    await user.keyboard("0");
    expect(onValidityChange).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  it("shows the cover preview only for a valid cover URL", () => {
    mockApi({});
    const { unmount } = renderWithProviders(
      <Harness initial={{ ...emptyBookDraft(), coverImageUrl: "https://img.example/a.png" }} />,
    );
    expect(screen.getByRole("img", { name: "Cover preview" })).toHaveAttribute("src", "https://img.example/a.png");
    unmount();
    renderWithProviders(<Harness initial={{ ...emptyBookDraft(), coverImageUrl: "nope" }} />);
    expect(screen.queryByRole("img", { name: "Cover preview" })).not.toBeInTheDocument();
  });

  it("shows a position field per selected series and reports its edit", async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    mockApi({});
    renderWithProviders(
      <Harness
        initial={{ ...emptyBookDraft(), series: [{ entry: { id: "s1", name: "Mistborn" }, position: "1" }] }}
        onDraft={onDraft}
      />,
    );
    const position = screen.getByRole("textbox", { name: "No. Mistborn" });
    expect(position).toHaveValue("1");
    await user.clear(position);
    await user.click(position);
    await user.paste("2,5");
    expect(onDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ series: [{ entry: { id: "s1", name: "Mistborn" }, position: "2,5" }] }),
    );
  });
});
