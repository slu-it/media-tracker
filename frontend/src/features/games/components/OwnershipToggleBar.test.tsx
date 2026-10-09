import { describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { flushAsync } from "../../../test/flushAsync";
import { OWNERSHIP_VALUES } from "../domain/gameStatus";
import { OwnershipToggleBar } from "./OwnershipToggleBar";

const NAMES = ["Watchlist", "Subscription", "Owned"];

describe("OwnershipToggleBar", () => {
  it("renders one button per ownership value in order, only the active one pressed", () => {
    renderWithProviders(<OwnershipToggleBar value="subscription" onChange={vi.fn()} />);
    expect(OWNERSHIP_VALUES).toHaveLength(NAMES.length);
    const group = screen.getByRole("group", { name: "Ownership" });
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(NAMES);
    expect(group.contains(buttons[0])).toBe(true);
    for (const button of buttons) {
      expect(button).toHaveAttribute(
        "aria-pressed",
        button.getAttribute("aria-label") === "Subscription" ? "true" : "false",
      );
    }
  });

  it("reports the clicked value", async () => {
    const onChange = vi.fn();
    renderWithProviders(<OwnershipToggleBar value="watchlist" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Owned" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("owned");
  });

  it("reports nothing when the active button is clicked", async () => {
    const onChange = vi.fn();
    renderWithProviders(<OwnershipToggleBar value="owned" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Owned" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("blocks changes while disabled and is marked busy", async () => {
    const onChange = vi.fn();
    renderWithProviders(<OwnershipToggleBar value="watchlist" onChange={onChange} disabled />);
    expect(screen.getByRole("group", { name: "Ownership" })).toHaveAttribute("aria-busy", "true");
    await userEvent.click(screen.getByRole("button", { name: "Owned" }), { pointerEventsCheck: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores Enter and Space on a focused button while disabled", async () => {
    const user = userEvent.setup();
    const errors = vi.spyOn(console, "error");
    const onChange = vi.fn();
    renderWithProviders(<OwnershipToggleBar value="watchlist" onChange={onChange} disabled />);
    const first = screen.getAllByRole("button")[0];
    act(() => first.focus());
    expect(first).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onChange).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it("names the group by the visible legend with showLabel", () => {
    renderWithProviders(<OwnershipToggleBar value="watchlist" onChange={vi.fn()} showLabel />, { realStyles: true });
    expect(screen.getAllByText("Ownership")).toHaveLength(1);
    expect(screen.getByText("Ownership")).toBeVisible();
    expect(screen.getByRole("group", { name: "Ownership" })).toBeInTheDocument();
  });

  it("names the group by an external label", () => {
    renderWithProviders(
      <>
        <span id="ext">Mine</span>
        <OwnershipToggleBar value="watchlist" onChange={vi.fn()} aria-labelledby="ext" />
      </>,
    );
    expect(screen.getByRole("group", { name: "Mine" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Ownership" })).not.toBeInTheDocument();
  });

  it("has no visible text on the buttons", () => {
    renderWithProviders(<OwnershipToggleBar value="watchlist" onChange={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) expect(button.textContent).toBe("");
  });

  it("shows the label as tooltip on hover", async () => {
    renderWithProviders(<OwnershipToggleBar value="watchlist" onChange={vi.fn()} />);
    await userEvent.hover(screen.getByRole("button", { name: "Owned" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Owned");
    await flushAsync();
  });

  it("renders the library icon on the subscription button", () => {
    renderWithProviders(<OwnershipToggleBar value="watchlist" onChange={vi.fn()} />);
    expect(
      within(screen.getByRole("button", { name: "Subscription" })).getByTestId("VideoLibraryOutlinedIcon"),
    ).toBeInTheDocument();
  });
});
