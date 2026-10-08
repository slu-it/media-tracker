import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { BookStatusIcons } from "./BookStatusIcons";

const names = () => screen.getAllByRole("img").map((icon) => icon.textContent);

describe("BookStatusIcons", () => {
  it("full variant shows the ownership icon before the progress icon", () => {
    renderWithProviders(<BookStatusIcons ownership="owned" progress="reading" />);
    expect(names()).toEqual(["Owned", "Reading"]);
  });

  it("full variant shows both icons for a watchlist book", () => {
    renderWithProviders(<BookStatusIcons ownership="watchlist" progress="not_started" />);
    expect(names()).toEqual(["Watchlist", "Not started"]);
  });

  it("shows an icon for every progress value", () => {
    for (const [progress, name] of [
      ["abandoned", "Abandoned"],
      ["paused", "Paused"],
      ["finished", "Finished"],
    ] as const) {
      const { unmount } = renderWithProviders(<BookStatusIcons ownership="owned" progress={progress} />);
      expect(screen.getByRole("img", { name })).toBeInTheDocument();
      unmount();
    }
  });

  it("card variant shows only the watchlist icon for a watchlist book", () => {
    renderWithProviders(<BookStatusIcons ownership="watchlist" progress="reading" variant="card" />);
    expect(names()).toEqual(["Watchlist"]);
  });

  it("card variant shows only the progress icon for an owned book", () => {
    renderWithProviders(<BookStatusIcons ownership="owned" progress="reading" variant="card" />);
    expect(names()).toEqual(["Reading"]);
  });
});
