import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { dune, earthsea } from "../../../test/fixtures/books";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { BookCard } from "./BookCard";

describe("BookCard", () => {
  it("shows only the watchlist icon after the title for a watchlist book", () => {
    renderWithProviders(<BookCard book={earthsea} onOpen={() => {}} />);
    const title = screen.getByText("A Wizard of Earthsea");
    const icon = screen.getByRole("img", { name: "Watchlist" });
    expect(title.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Not started" })).not.toBeInTheDocument();
  });

  it("shows only the progress icon for an owned book", () => {
    renderWithProviders(<BookCard book={dune} onOpen={() => {}} />);
    expect(screen.queryByRole("img", { name: "Owned" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Reading" })).toBeInTheDocument();
  });

  it("shows the type chips, none when empty", () => {
    const { unmount } = renderWithProviders(<BookCard book={dune} onOpen={() => {}} />);
    expect(screen.getByText("Hardcover")).toBeInTheDocument();
    expect(screen.getByText("Kindle")).toBeInTheDocument();
    unmount();
    renderWithProviders(<BookCard book={earthsea} onOpen={() => {}} />);
    expect(screen.queryByText("Hardcover")).not.toBeInTheDocument();
  });

  it("opens the book on click", async () => {
    const onOpen = vi.fn();
    renderWithProviders(<BookCard book={dune} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Dune" }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(dune);
  });
});
