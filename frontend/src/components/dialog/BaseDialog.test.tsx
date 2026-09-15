import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { BaseDialog } from "./BaseDialog";
import { DialogActionButton } from "./DialogActionButton";

describe("BaseDialog", () => {
  it("renders content, the action sidebar and a close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onAction = vi.fn();
    renderWithProviders(
      <BaseDialog
        open
        onClose={onClose}
        actions={<DialogActionButton icon={<span />} label="Do it" onClick={onAction} />}
      >
        <p>Body</p>
      </BaseDialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Body");
    await user.click(screen.getByRole("button", { name: "Do it" }));
    expect(onAction).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <BaseDialog open onClose={onClose}>
        <p>Body</p>
      </BaseDialog>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders bottomActions at the bottom of the sidebar, pushed down from actions, and reacts to clicks", async () => {
    const user = userEvent.setup();
    const onBottomAction = vi.fn();
    renderWithProviders(
      <BaseDialog
        open
        onClose={() => {}}
        actions={<DialogActionButton icon={<span />} label="Top" onClick={() => {}} />}
        bottomActions={<DialogActionButton icon={<span />} label="Bottom" onClick={onBottomAction} />}
      >
        <p>Body</p>
      </BaseDialog>,
    );
    const topButton = screen.getByRole("button", { name: "Top" });
    const bottomButton = screen.getByRole("button", { name: "Bottom" });
    const sidebar = topButton.parentElement!.parentElement!;
    const bottomWrapper = bottomButton.parentElement!.parentElement!;
    // The bottom wrapper is the sidebar's last child and relies on margin-top: auto (not fought further in
    // jsdom, which does support this on flex children) to sit at the bottom; the Stack itself uses gap-based
    // spacing (useFlexGap) rather than margins, so it doesn't cancel that auto margin out.
    expect(sidebar.lastElementChild).toBe(bottomWrapper);
    expect(getComputedStyle(bottomWrapper).marginTop).toBe("auto");
    expect(getComputedStyle(sidebar).gap).not.toBe("");
    await user.click(bottomButton);
    expect(onBottomAction).toHaveBeenCalledOnce();
  });

  it("applies a fixed height to the paper when given, capped by the viewport", () => {
    renderWithProviders(
      <BaseDialog open onClose={() => {}} height={640}>
        <p>Body</p>
      </BaseDialog>,
    );
    const paper = screen.getByRole("dialog");
    // jsdom resolves min()/calc(100vh - ...) against its viewport (default innerHeight 768), so the expected
    // px value is viewport-coupled, not a fixed "640px".
    const expectedHeight = Math.min(640, window.innerHeight - 96);
    expect(getComputedStyle(paper).height).toBe(`${expectedHeight}px`);
  });
});
