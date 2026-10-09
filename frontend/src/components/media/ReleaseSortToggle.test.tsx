import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ReleaseSortToggle } from "./ReleaseSortToggle";

describe("ReleaseSortToggle", () => {
  it("shows both options with the legend naming the group", () => {
    renderWithProviders(<ReleaseSortToggle value="release_asc" onChange={() => {}} />, { realStyles: true });
    expect(screen.getByRole("group", { name: "Sort order" })).toBeInTheDocument();
    expect(screen.getByText("Sort order")).toBeVisible();
    expect(screen.getByRole("button", { name: "Oldest first" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Newest first" })).toBeInTheDocument();
  });

  it("marks the current value as pressed", () => {
    renderWithProviders(<ReleaseSortToggle value="release_desc" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Newest first" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Oldest first" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the other value once it is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ReleaseSortToggle value="release_asc" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Newest first" }));
    expect(onChange).toHaveBeenCalledWith("release_desc");
  });

  it("keeps the selection when the already-selected button is clicked again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ReleaseSortToggle value="release_asc" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Oldest first" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Oldest first" })).toHaveAttribute("aria-pressed", "true");
  });
});
