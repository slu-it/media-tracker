import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("returns true for yes", async () => {
    const user = userEvent.setup();
    const onDecision = vi.fn();
    renderWithProviders(<ConfirmDialog open question="Delete it?" onDecision={onDecision} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Delete it?");
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(onDecision).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("returns false for no and for Escape", async () => {
    const user = userEvent.setup();
    const onDecision = vi.fn();
    renderWithProviders(<ConfirmDialog open question="Delete it?" onDecision={onDecision} />);
    await user.click(screen.getByRole("button", { name: "No" }));
    expect(onDecision).toHaveBeenLastCalledWith(false);
    await user.keyboard("{Escape}");
    expect(onDecision).toHaveBeenLastCalledWith(false);
    expect(onDecision).toHaveBeenCalledTimes(2);
  });

  it("renders nothing while closed", () => {
    renderWithProviders(<ConfirmDialog open={false} question="Delete it?" onDecision={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
