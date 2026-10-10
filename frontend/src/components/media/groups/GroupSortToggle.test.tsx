import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GroupSortToggle } from "./GroupSortToggle";

describe("GroupSortToggle", () => {
  it("shows the legend, the name option and the kind's volume label", () => {
    renderWithProviders(<GroupSortToggle value="name" volumeLabel="Most books" onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Sort order" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Name" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Most books" })).toHaveAttribute("aria-pressed", "false");
  });

  it("marks volume as pressed and reports a click on the other button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<GroupSortToggle value="volume" volumeLabel="Most books" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Most books" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onChange).toHaveBeenCalledWith("name");
  });

  it("keeps the selection when the selected button is clicked again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<GroupSortToggle value="name" volumeLabel="Most books" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
