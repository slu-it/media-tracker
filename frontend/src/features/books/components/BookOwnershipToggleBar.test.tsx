import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { BookOwnershipToggleBar } from "./BookOwnershipToggleBar";

describe("BookOwnershipToggleBar", () => {
  it("renders one button per ownership value in order, only the active one pressed", () => {
    renderWithProviders(<BookOwnershipToggleBar value="owned" onChange={vi.fn()} />);
    const group = screen.getByRole("group", { name: "Ownership" });
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Watchlist", "Owned"]);
    expect(group.contains(buttons[0])).toBe(true);
    expect(screen.getByRole("button", { name: "Owned" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Watchlist" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the clicked value and nothing for the active button", async () => {
    const onChange = vi.fn();
    renderWithProviders(<BookOwnershipToggleBar value="watchlist" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Watchlist" }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Owned" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("owned");
  });

  it("blocks changes while disabled and is marked busy", async () => {
    const onChange = vi.fn();
    renderWithProviders(<BookOwnershipToggleBar value="watchlist" onChange={onChange} disabled />);
    expect(screen.getByRole("group", { name: "Ownership" })).toHaveAttribute("aria-busy", "true");
    await userEvent.click(screen.getByRole("button", { name: "Owned" }), { pointerEventsCheck: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names the group by the visible legend with showLabel", () => {
    renderWithProviders(<BookOwnershipToggleBar value="watchlist" onChange={vi.fn()} showLabel />, {
      realStyles: true,
    });
    expect(screen.getByText("Ownership")).toBeVisible();
    expect(screen.getByRole("group", { name: "Ownership" })).toBeInTheDocument();
  });
});
