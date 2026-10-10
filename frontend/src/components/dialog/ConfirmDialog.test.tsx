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

  it("uses custom button labels", async () => {
    const user = userEvent.setup();
    const onDecision = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        open
        question="Merge it?"
        onDecision={onDecision}
        confirmLabel="Merge"
        cancelLabel="Choose another name"
      />,
    );
    expect(screen.queryByRole("button", { name: "Yes" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Choose another name" }));
    expect(onDecision).toHaveBeenLastCalledWith(false);
    await user.click(screen.getByRole("button", { name: "Merge" }));
    expect(onDecision).toHaveBeenLastCalledWith(true);
  });

  it("focuses the confirm button by default and the cancel button with focusCancel", () => {
    const { unmount } = renderWithProviders(<ConfirmDialog open question="Merge it?" onDecision={() => {}} />);
    expect(screen.getByRole("button", { name: "Yes" })).toHaveFocus();
    unmount();
    renderWithProviders(<ConfirmDialog open question="Merge it?" onDecision={() => {}} focusCancel />);
    expect(screen.getByRole("button", { name: "No" })).toHaveFocus();
  });

  it("renders nothing while closed", () => {
    renderWithProviders(<ConfirmDialog open={false} question="Delete it?" onDecision={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
