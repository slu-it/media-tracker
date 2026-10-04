import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GameStatusIcons } from "./GameStatusIcons";

describe("GameStatusIcons", () => {
  it("shows no hidden icon for the not hidden default", () => {
    renderWithProviders(<GameStatusIcons ownership="owned" progress="not_started" hidden={false} />);
    expect(screen.getAllByRole("img").map((icon) => icon.textContent)).toEqual(["Owned", "Not started"]);
  });

  it("shows the ownership icon before the progress icon, both with accessible names", () => {
    renderWithProviders(<GameStatusIcons ownership="watchlist" progress="playing" hidden={false} />);

    const icons = screen.getAllByRole("img");
    expect(icons.map((icon) => icon.textContent)).toEqual(["Watchlist", "Playing"]);
  });

  it("shows the Owned icon before the progress icon when ownership is owned", () => {
    renderWithProviders(<GameStatusIcons ownership="owned" progress="finished" hidden={false} />);
    expect(screen.getAllByRole("img").map((icon) => icon.textContent)).toEqual(["Owned", "Finished"]);
  });

  it("shows the ownership and not started icons when progress is the default", () => {
    renderWithProviders(<GameStatusIcons ownership="watchlist" progress="not_started" hidden={false} />);
    expect(screen.getAllByRole("img").map((icon) => icon.textContent)).toEqual(["Watchlist", "Not started"]);
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

  it("card variant shows only the watchlist icon for a watchlist game", () => {
    renderWithProviders(<GameStatusIcons ownership="watchlist" progress="playing" hidden={false} variant="card" />);
    expect(screen.getAllByRole("img").map((icon) => icon.textContent)).toEqual(["Watchlist"]);
  });

  it("card variant shows only the progress icon for an owned game", () => {
    renderWithProviders(<GameStatusIcons ownership="owned" progress="playing" hidden={false} variant="card" />);
    expect(screen.getAllByRole("img").map((icon) => icon.textContent)).toEqual(["Playing"]);
  });

  it("card variant shows the Subscription icon before the progress icon for a subscription game", () => {
    renderWithProviders(<GameStatusIcons ownership="subscription" progress="playing" hidden={false} variant="card" />);
    expect(screen.getAllByRole("img").map((icon) => icon.textContent)).toEqual(["Subscription", "Playing"]);
  });

  it("card variant still shows the hidden icon", () => {
    renderWithProviders(<GameStatusIcons ownership="watchlist" progress="playing" hidden={true} variant="card" />);
    expect(screen.getAllByRole("img").map((icon) => icon.textContent)).toEqual(["Watchlist", "Hidden"]);
  });
});
