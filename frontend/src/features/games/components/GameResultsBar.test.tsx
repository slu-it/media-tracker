import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GameResultsBar } from "./GameResultsBar";

/** The results row: the status region sits in the left wrapper, which sits in the row. */
// eslint-disable-next-line testing-library/no-node-access -- the row has no role; status sits in the left wrapper in the row
const rowOf = (status: HTMLElement) => status.parentElement!.parentElement!;
const isHidden = (row: HTMLElement) => {
  const style = getComputedStyle(row);
  return style.position === "absolute" && style.width === "1px";
};

describe("GameResultsBar", () => {
  it("shows the singular count", () => {
    renderWithProviders(<GameResultsBar count={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("1 game");
  });

  it("shows the plural count", () => {
    renderWithProviders(<GameResultsBar count={142} />);
    expect(screen.getByRole("status")).toHaveTextContent("142 games");
  });

  it("shows the German singular count", async () => {
    await i18n.changeLanguage("de");
    renderWithProviders(<GameResultsBar count={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("1 Spiel");
  });

  it("shows the German plural count", async () => {
    await i18n.changeLanguage("de");
    renderWithProviders(<GameResultsBar count={142} />);
    expect(screen.getByRole("status")).toHaveTextContent("142 Spiele");
  });

  it("shows no status text while count is null but still renders children", () => {
    renderWithProviders(
      <GameResultsBar count={null}>
        <button type="button">Right slot</button>
      </GameResultsBar>,
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Right slot" })).toBeInTheDocument();
  });

  it("shows the count without children", () => {
    renderWithProviders(<GameResultsBar count={3} />);
    expect(screen.getByRole("status")).toHaveTextContent("3 games");
    expect(within(screen.getByRole("status")).queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the status region mounted with the zero-count announcement when count is 0, and drops children", () => {
    renderWithProviders(
      <GameResultsBar count={0}>
        <button type="button">Right slot</button>
      </GameResultsBar>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("0 games");
    expect(screen.queryByRole("button", { name: "Right slot" })).not.toBeInTheDocument();
    expect(isHidden(rowOf(screen.getByRole("status")))).toBe(true);
  });

  it("is visible at count 0 only with facts, and the live region survives switching facts", () => {
    const { rerender } = renderWithProviders(<GameResultsBar count={0} />);
    const status = screen.getByRole("status");
    expect(isHidden(rowOf(status))).toBe(true);

    rerender(<GameResultsBar count={0} facts={<button type="button">Facts slot</button>} />);
    expect(screen.getByRole("status")).toBe(status);
    expect(isHidden(rowOf(status))).toBe(false);

    rerender(<GameResultsBar count={0} />);
    expect(screen.getByRole("status")).toBe(status);
    expect(isHidden(rowOf(status))).toBe(true);
  });

  it("keeps the facts slot visible outside the status region at count 0 and drops the children", () => {
    renderWithProviders(
      <GameResultsBar count={0} facts={<button type="button">Facts slot</button>}>
        <button type="button">Right slot</button>
      </GameResultsBar>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("0 games");
    expect(screen.getByRole("button", { name: "Facts slot" })).toBeInTheDocument();
    expect(isHidden(rowOf(screen.getByRole("status")))).toBe(false);
    expect(within(screen.getByRole("status")).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Right slot" })).not.toBeInTheDocument();
  });

  it("renders the facts slot and the children for a positive count and while count is null", () => {
    const { rerender } = renderWithProviders(
      <GameResultsBar count={5} facts={<button type="button">Facts slot</button>}>
        <button type="button">Right slot</button>
      </GameResultsBar>,
    );
    expect(screen.getByRole("button", { name: "Facts slot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Right slot" })).toBeInTheDocument();

    rerender(
      <GameResultsBar count={null} facts={<button type="button">Facts slot</button>}>
        <button type="button">Right slot</button>
      </GameResultsBar>,
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Facts slot" })).toBeInTheDocument();
  });
});
