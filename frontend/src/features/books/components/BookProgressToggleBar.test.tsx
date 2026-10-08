import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { BookProgressToggleBar } from "./BookProgressToggleBar";

describe("BookProgressToggleBar", () => {
  it("renders one button per progress value in order, only the active one pressed", () => {
    renderWithProviders(<BookProgressToggleBar value="reading" onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Abandoned",
      "Not started",
      "Paused",
      "Reading",
      "Finished",
    ]);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute(
        "aria-pressed",
        button.getAttribute("aria-label") === "Reading" ? "true" : "false",
      );
    }
  });

  it("renders the reading icon", () => {
    renderWithProviders(<BookProgressToggleBar value="reading" onChange={vi.fn()} />);
    expect(within(screen.getByRole("button", { name: "Reading" })).getByTestId("AutoStoriesIcon")).toBeInTheDocument();
  });

  it("reports the clicked value and nothing for the active button", async () => {
    const onChange = vi.fn();
    renderWithProviders(<BookProgressToggleBar value="reading" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Reading" }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Finished" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("finished");
  });

  it("blocks changes while disabled and is marked busy", async () => {
    const onChange = vi.fn();
    renderWithProviders(<BookProgressToggleBar value="reading" onChange={onChange} disabled />);
    expect(screen.getByRole("group", { name: "Progress" })).toHaveAttribute("aria-busy", "true");
    await userEvent.click(screen.getByRole("button", { name: "Finished" }), { pointerEventsCheck: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
