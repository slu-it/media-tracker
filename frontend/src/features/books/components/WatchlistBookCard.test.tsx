import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dune, earthsea, hardcover } from "../../../test/fixtures/books";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { WatchlistBookCard } from "./WatchlistBookCard";

const TITLE = "A Wizard of Earthsea";

describe("WatchlistBookCard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the formatted release date when one is set", () => {
    const dated = { ...earthsea, releaseDate: "1968-11-01" };
    renderWithProviders(<WatchlistBookCard book={dated} onOpen={() => {}} />);
    expect(screen.getByText("1968-11-01")).toBeInTheDocument();
    expect(screen.getByText("-P57Y11M8D")).toBeInTheDocument();
    // Wired as an accessible description (see MediaCardShell), so it is announced alongside the title.
    expect(screen.getByRole("button", { name: TITLE })).toHaveAccessibleDescription("1968-11-01 -P57Y11M8D");
  });

  it("falls back to the release year when no release date is set", () => {
    renderWithProviders(<WatchlistBookCard book={earthsea} onOpen={() => {}} />);
    expect(screen.getByText(String(earthsea.releaseYear))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: TITLE })).toHaveAccessibleDescription(String(earthsea.releaseYear));
    expect(screen.queryByText(/^-?P(\d+[YMD])+$/)).not.toBeInTheDocument();
  });

  it("shows the cover in grayscale at half opacity, every card here is a watchlist book", () => {
    renderWithProviders(<WatchlistBookCard book={earthsea} onOpen={() => {}} />, { realStyles: true });
    // eslint-disable-next-line testing-library/no-node-access -- the sized frame isn't exposed via any ARIA role
    const frame = screen.getByTitle("No cover image").closest("div");
    expect(frame).toHaveStyle({ filter: "grayscale(1)", opacity: "0.5" });
  });

  it("shows no type chips or status icons", () => {
    renderWithProviders(<WatchlistBookCard book={{ ...dune, types: [hardcover] }} onOpen={() => {}} />);
    expect(screen.queryByText("Hardcover")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("opens the book when the card is clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderWithProviders(<WatchlistBookCard book={earthsea} onOpen={onOpen} />);

    await user.click(screen.getByRole("button", { name: TITLE }));
    expect(onOpen).toHaveBeenCalledWith(earthsea);
  });
});
