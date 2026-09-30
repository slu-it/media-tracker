import { describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { flushAsync } from "../../../test/flushAsync";
import { PROGRESS_VALUES } from "../domain/gameStatus";
import { ProgressToggleBar } from "./ProgressToggleBar";

const NAMES = ["Abandoned", "Not started", "Paused", "Playing", "Finished", "100%"];

describe("ProgressToggleBar", () => {
  it("renders one button per progress value in order, only the active one pressed", () => {
    renderWithProviders(<ProgressToggleBar value="playing" onChange={vi.fn()} />);
    expect(PROGRESS_VALUES).toHaveLength(NAMES.length);
    const group = screen.getByRole("group", { name: "Progress" });
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(NAMES);
    expect(group.contains(buttons[0])).toBe(true);
    for (const button of buttons) {
      expect(button).toHaveAttribute(
        "aria-pressed",
        button.getAttribute("aria-label") === "Playing" ? "true" : "false",
      );
    }
  });

  it("has no visible text on the buttons", () => {
    renderWithProviders(<ProgressToggleBar value="playing" onChange={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) expect(button.textContent).toBe("");
  });

  it("reports the clicked value", async () => {
    const onChange = vi.fn();
    renderWithProviders(<ProgressToggleBar value="playing" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Paused" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("paused");
  });

  it("reports nothing when the active button is clicked", async () => {
    const onChange = vi.fn();
    renderWithProviders(<ProgressToggleBar value="playing" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Playing" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the label as tooltip on hover", async () => {
    renderWithProviders(<ProgressToggleBar value="playing" onChange={vi.fn()} />);
    await userEvent.hover(screen.getByRole("button", { name: "Finished" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Finished");
    await flushAsync();
  });

  it("blocks changes while disabled and is marked busy", async () => {
    const onChange = vi.fn();
    renderWithProviders(<ProgressToggleBar value="playing" onChange={onChange} disabled />);
    expect(screen.getByRole("group", { name: "Progress" })).toHaveAttribute("aria-busy", "true");
    await userEvent.click(screen.getByRole("button", { name: "Paused" }), { pointerEventsCheck: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores Enter and Space on a focused button while disabled", async () => {
    const user = userEvent.setup();
    const errors = vi.spyOn(console, "error");
    const onChange = vi.fn();
    renderWithProviders(<ProgressToggleBar value="playing" onChange={onChange} disabled />);
    // MUI's ButtonBase takes aria-disabled buttons out of the tab order (tabindex -1), so Tab skips them; focus
    // one programmatically to prove the keys are ignored even if focus got there anyway.
    await user.tab();
    for (const button of screen.getAllByRole("button")) expect(button).not.toHaveFocus();
    const first = screen.getAllByRole("button")[0];
    act(() => first.focus());
    expect(first).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onChange).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });
});
