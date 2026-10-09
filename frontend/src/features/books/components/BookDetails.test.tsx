import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { dune, earthsea, herbert, simonVance } from "../../../test/fixtures/books";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { BookDetails } from "./BookDetails";

describe("BookDetails", () => {
  it("shows the title heading followed by both status icons", () => {
    renderWithProviders(<BookDetails book={dune} titleId="title" />);
    const title = screen.getByRole("heading", { name: "Dune" });
    const icon = screen.getByRole("img", { name: "Owned" });
    expect(title.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("img", { name: "Reading" })).toBeInTheDocument();
  });

  it("shows description, release year, type chips and author chips", () => {
    renderWithProviders(<BookDetails book={{ ...dune, description: "Spice." }} titleId="title" />);
    expect(screen.getByText("Spice.")).toBeInTheDocument();
    expect(screen.getByText("1965")).toBeInTheDocument();
    expect(screen.getByText("Types")).toBeInTheDocument();
    expect(screen.getByText("Hardcover")).toBeInTheDocument();
    expect(screen.getByText("Kindle")).toBeInTheDocument();
    expect(screen.getByText("Authors")).toBeInTheDocument();
    expect(screen.getByText(herbert.name)).toBeInTheDocument();
  });

  it("shows no types field for a book without types", () => {
    renderWithProviders(<BookDetails book={earthsea} titleId="title" />);
    expect(screen.queryByText("Types")).not.toBeInTheDocument();
    expect(screen.getByText("Authors")).toBeInTheDocument();
  });

  it("shows no authors field for a book without authors, but still its narrators", () => {
    renderWithProviders(<BookDetails book={{ ...dune, authors: [], narrators: [simonVance] }} titleId="title" />);
    expect(screen.queryByText("Authors")).not.toBeInTheDocument();
    expect(screen.getByText("Narrators")).toBeInTheDocument();
    expect(screen.getByText(simonVance.name)).toBeInTheDocument();
  });

  it("shows the quick bars only when their callbacks are given", () => {
    const { unmount } = renderWithProviders(
      <BookDetails book={dune} titleId="title" onOwnershipChange={() => {}} onProgressChange={() => {}} />,
    );
    const ownership = screen.getByRole("group", { name: "Ownership" });
    const progress = screen.getByRole("group", { name: "Progress" });
    expect(ownership.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true");
    unmount();

    renderWithProviders(<BookDetails book={dune} titleId="title" />);
    expect(screen.queryByRole("group", { name: "Ownership" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Progress" })).not.toBeInTheDocument();
  });

  it("emits the clicked ownership and progress, and nothing while quickSaveBusy", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onOwnershipChange = vi.fn();
    const onProgressChange = vi.fn();
    const props = { book: dune, titleId: "title", onOwnershipChange, onProgressChange };
    const { unmount } = renderWithProviders(<BookDetails {...props} />);
    await user.click(screen.getByRole("button", { name: "Watchlist" }));
    expect(onOwnershipChange).toHaveBeenCalledExactlyOnceWith("watchlist");
    await user.click(screen.getByRole("button", { name: "Finished" }));
    expect(onProgressChange).toHaveBeenCalledExactlyOnceWith("finished");
    unmount();

    onOwnershipChange.mockClear();
    onProgressChange.mockClear();
    renderWithProviders(<BookDetails {...props} quickSaveBusy />);
    expect(screen.getByRole("group", { name: "Ownership" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("group", { name: "Progress" })).toHaveAttribute("aria-busy", "true");
    await user.click(screen.getByRole("button", { name: "Watchlist" }));
    await user.click(screen.getByRole("button", { name: "Finished" }));
    expect(onOwnershipChange).not.toHaveBeenCalled();
    expect(onProgressChange).not.toHaveBeenCalled();
  });

  it("shows series chips first, then the grid in the order release, types, authors, narrators", () => {
    renderWithProviders(
      <BookDetails
        book={{
          ...dune,
          description: "Spice.",
          narrators: [simonVance],
          series: [
            { id: "s1", name: "Dune Saga", position: 2.5 },
            { id: "s2", name: "Cosmere", position: null },
            { id: "s3", name: "Mistborn", position: 1 },
          ],
        }}
        titleId="title"
      />,
    );
    const following = (a: HTMLElement, b: HTMLElement) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const title = screen.getByRole("heading", { name: "Dune" });
    const series = screen.getByRole("group", { name: "Series" });
    expect(within(series).getByText("Mistborn #1")).toBeInTheDocument();
    const description = screen.getByText("Spice.");
    const release = screen.getByText("Release year");
    const types = screen.getByText("Types");
    const authors = screen.getByText("Authors");
    const narrators = screen.getByText("Narrators");
    expect(following(title, series)).toBe(true);
    expect(following(series, description)).toBe(true);
    expect(following(description, release)).toBe(true);
    expect(following(release, types)).toBe(true);
    expect(following(types, authors)).toBe(true);
    expect(following(authors, narrators)).toBe(true);
    expect(screen.getByText(simonVance.name)).toBeInTheDocument();
    expect(screen.getByText("Dune Saga #2.5")).toBeInTheDocument();
    expect(screen.getByText("Cosmere")).toBeInTheDocument();
  });

  it("hides the narrators field and series chips when empty", () => {
    renderWithProviders(<BookDetails book={dune} titleId="title" />);
    expect(screen.queryByText("Narrators")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Series" })).not.toBeInTheDocument();
  });
});
