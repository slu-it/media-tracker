import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
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

  it("shows the series position badge only for a number", () => {
    const { unmount } = renderWithProviders(<BookCard book={dune} onOpen={() => {}} seriesPosition={2.5} />);
    expect(screen.getByText("#2.5")).toBeInTheDocument();
    unmount();
    const { unmount: unmountNull } = renderWithProviders(
      <BookCard book={dune} onOpen={() => {}} seriesPosition={null} />,
    );
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
    unmountNull();
    renderWithProviders(<BookCard book={dune} onOpen={() => {}} />);
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
  });

  it("places the series position badge above the cover", () => {
    renderWithProviders(<BookCard book={dune} onOpen={() => {}} seriesPosition={2.5} />);
    const badge = screen.getByText("#2.5");
    // eslint-disable-next-line testing-library/no-node-access -- the decorative cover (alt="") has no ARIA role
    const cover = screen.getByRole("button", { name: "Dune" }).querySelector("img");
    expect(cover).not.toBeNull();
    expect(badge.compareDocumentPosition(cover as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reserves an invisible, unannounced placeholder for a null position, none in the overview", () => {
    const { unmount } = renderWithProviders(<BookCard book={dune} onOpen={() => {}} seriesPosition={null} />);
    const button = screen.getByRole("button", { name: "Dune" });
    expect(button).toHaveAccessibleDescription("");
    const describedBy = button.getAttribute("aria-describedby") as string;
    // eslint-disable-next-line testing-library/no-node-access -- the placeholder has no role or text
    const placeholder = document.getElementById(describedBy)?.firstElementChild as HTMLElement;
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(placeholder).toHaveStyle({ visibility: "hidden" });
    expect(placeholder).toBeEmptyDOMElement();
    unmount();
    renderWithProviders(<BookCard book={dune} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: "Dune" })).not.toHaveAttribute("aria-describedby");
  });

  it("announces the series position as the card description", () => {
    renderWithProviders(<BookCard book={dune} onOpen={() => {}} seriesPosition={2.5} />);
    expect(screen.getByRole("button", { name: "Dune" })).toHaveAccessibleDescription("#2.5");
  });

  it("formats the series position in German", async () => {
    await i18n.changeLanguage("de");
    renderWithProviders(<BookCard book={dune} onOpen={() => {}} seriesPosition={2.5} />);
    expect(screen.getByText("#2,5")).toBeInTheDocument();
  });

  it("opens the book on click", async () => {
    const onOpen = vi.fn();
    renderWithProviders(<BookCard book={dune} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Dune" }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(dune);
  });
});
