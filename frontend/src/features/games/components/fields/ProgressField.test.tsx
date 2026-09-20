import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/renderWithProviders";
import { ProgressField } from "./ProgressField";

describe("ProgressField", () => {
  it("offers all progress options in order and reports the selected value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ProgressField value="not_started" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: /progress/i }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Not started",
      "Playing",
      "Finished",
      "100%",
      "Paused",
      "Abandoned",
    ]);

    await user.click(screen.getByRole("option", { name: "100%" }));
    expect(onChange).toHaveBeenCalledWith("completed");
  });

  it("can be disabled", () => {
    renderWithProviders(<ProgressField value="not_started" onChange={() => {}} disabled />);
    expect(screen.getByRole("combobox", { name: /progress/i })).toHaveAttribute("aria-disabled", "true");
  });
});
