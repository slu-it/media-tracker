import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { dune, earthsea, mistborn } from "../../../test/fixtures/books";
import type { BookResponse } from "../../../types/api";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { BookCard } from "./BookCard";

const twoSeries: BookResponse = {
  ...dune,
  series: [
    { id: mistborn.id, name: "Mistborn", position: 1 },
    { id: "series-9", name: "Cosmere", position: null },
  ],
};

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

  it("reserves an invisible, unannounced placeholder for a null position", () => {
    renderWithProviders(<BookCard book={dune} onOpen={() => {}} seriesPosition={null} />);
    const button = screen.getByRole("button", { name: "Dune" });
    expect(button).toHaveAccessibleDescription("");
    const describedBy = button.getAttribute("aria-describedby") as string;
    // eslint-disable-next-line testing-library/no-node-access -- the placeholder has no role or text
    const placeholder = document.getElementById(describedBy)?.firstElementChild as HTMLElement;
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(placeholder).toHaveStyle({ visibility: "hidden" });
    expect(placeholder).toBeEmptyDOMElement();
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

  it("shows one series chip per series in order, name only without a position", () => {
    renderWithProviders(<BookCard book={twoSeries} onOpen={() => {}} />);
    const first = screen.getByText("Mistborn #1");
    const second = screen.getByText("Cosmere");
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("places the title after the cover, then the series chip and the type chip", () => {
    renderWithProviders(<BookCard book={twoSeries} onOpen={() => {}} />);
    const chip = screen.getByText("Mistborn #1");
    const type = screen.getByText("Hardcover");
    // eslint-disable-next-line testing-library/no-node-access -- the decorative cover (alt="") has no ARIA role
    const cover = screen.getByRole("button", { name: "Dune" }).querySelector("img") as Element;
    const title = screen.getByRole("heading", { level: 3, name: "Dune" });
    expect(cover.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chip.compareDocumentPosition(type) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const status = screen.getByRole("img", { name: "Reading" });
    expect(type.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the type chips in the series view without announcing them", () => {
    renderWithProviders(<BookCard book={dune} onOpen={() => {}} seriesPosition={2.5} />);
    expect(screen.getByText("Hardcover")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dune" })).toHaveAccessibleDescription("#2.5");
  });

  it("announces the series and type chips as the card description", () => {
    renderWithProviders(<BookCard book={twoSeries} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: "Dune" })).toHaveAccessibleDescription(
      "Mistborn #1 Cosmere Hardcover Kindle",
    );
  });

  it("reserves a hidden placeholder and shows no chip for a book without series", () => {
    renderWithProviders(<BookCard book={dune} onOpen={() => {}} />);
    const button = screen.getByRole("button", { name: "Dune" });
    expect(button).toHaveAccessibleDescription("Hardcover Kindle");
    const describedBy = button.getAttribute("aria-describedby") as string;
    // eslint-disable-next-line testing-library/no-node-access -- the placeholder has no role or text
    const placeholder = document.getElementById(describedBy)?.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(placeholder).toHaveStyle({ visibility: "hidden" });
    expect(placeholder).toBeEmptyDOMElement();
  });

  it("formats the series chip position in German", async () => {
    await i18n.changeLanguage("de");
    const book = { ...dune, series: [{ id: mistborn.id, name: "Mistborn", position: 2.5 }] };
    renderWithProviders(<BookCard book={book} onOpen={() => {}} />);
    expect(screen.getByText("Mistborn #2,5")).toBeInTheDocument();
  });

  it("shows the badge and no series chip when a series position is given", () => {
    renderWithProviders(<BookCard book={twoSeries} onOpen={() => {}} seriesPosition={1} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.queryByText("Mistborn #1")).not.toBeInTheDocument();
    expect(screen.queryByText("Cosmere")).not.toBeInTheDocument();
  });
});
