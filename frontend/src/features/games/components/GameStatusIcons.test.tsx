import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GameStatusIcons } from "./GameStatusIcons";

describe("GameStatusIcons", () => {
  it("renders nothing for the quiet values (owned, not started, not hidden)", () => {
    const { container } = renderWithProviders(
      <GameStatusIcons ownership="owned" progress="not_started" hidden={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the ownership icon before the progress icon, both with accessible names", () => {
    renderWithProviders(<GameStatusIcons ownership="watchlist" progress="playing" hidden={false} />);

    const icons = screen.getAllByRole("img");
    expect(icons.map((icon) => icon.textContent)).toEqual(["Watchlist", "Playing"]);
  });

  it("shows only the progress icon when ownership is owned", () => {
    renderWithProviders(<GameStatusIcons ownership="owned" progress="finished" hidden={false} />);
    expect(screen.getByRole("img", { name: "Finished" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Owned" })).not.toBeInTheDocument();
  });

  it("shows only the ownership icon when progress is the default", () => {
    renderWithProviders(<GameStatusIcons ownership="watchlist" progress="not_started" hidden={false} />);
    expect(screen.getByRole("img", { name: "Watchlist" })).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("shows an icon for every other progress value", () => {
    renderWithProviders(<GameStatusIcons ownership="owned" progress="completed" hidden={false} />);
    expect(screen.getByRole("img", { name: "100%" })).toBeInTheDocument();
  });

  it("shows an icon for the paused progress value", () => {
    renderWithProviders(<GameStatusIcons ownership="owned" progress="paused" hidden={false} />);
    expect(screen.getByRole("img", { name: "Paused" })).toBeInTheDocument();
  });

  it("shows an icon for the abandoned progress value", () => {
    renderWithProviders(<GameStatusIcons ownership="owned" progress="abandoned" hidden={false} />);
    expect(screen.getByRole("img", { name: "Abandoned" })).toBeInTheDocument();
  });

  it("shows the hidden icon after the progress icon when hidden is true", () => {
    renderWithProviders(<GameStatusIcons ownership="watchlist" progress="playing" hidden={true} />);
    const icons = screen.getAllByRole("img");
    expect(icons.map((icon) => icon.textContent)).toEqual(["Watchlist", "Playing", "Hidden"]);
  });

  it("shows no hidden icon when hidden is false", () => {
    renderWithProviders(<GameStatusIcons ownership="watchlist" progress="playing" hidden={false} />);
    expect(screen.queryByRole("img", { name: "Hidden" })).not.toBeInTheDocument();
  });
});
