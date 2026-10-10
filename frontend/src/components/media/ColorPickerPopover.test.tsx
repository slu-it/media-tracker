import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { COLOR_PALETTE } from "../../domain/media/colorPalette";
import { ColorPickerPopover } from "./ColorPickerPopover";

function Harness({ onApply, onClose }: { onApply: (color: string) => void; onClose: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button onClick={(event) => setAnchor(event.currentTarget)}>Open</button>
      <ColorPickerPopover anchorEl={anchor} color="0070D1" previewLabel="Kindle" onApply={onApply} onClose={onClose} />
    </>
  );
}

async function open() {
  const user = userEvent.setup();
  const onApply = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(<Harness onApply={onApply} onClose={onClose} />);
  await user.click(screen.getByRole("button", { name: "Open" }));
  return { user, onApply, onClose };
}

describe("ColorPickerPopover", () => {
  it("offers every palette color and marks the current one as pressed", async () => {
    await open();
    expect(screen.getAllByRole("button", { name: /\(#[0-9A-F]{6}\)$/ })).toHaveLength(COLOR_PALETTE.length);
    expect(screen.getByRole("button", { name: "Blue (#0070D1)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Red (#E60012)" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("textbox", { name: "Hex color" })).toHaveValue("0070D1");
  });

  it("applies a picked swatch", async () => {
    const { user, onApply } = await open();
    await user.click(screen.getByRole("button", { name: "Red (#E60012)" }));
    expect(screen.getByRole("button", { name: "Red (#E60012)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Hex color" })).toHaveValue("E60012");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith("E60012");
  });

  it("applies a typed hex code normalised", async () => {
    const { user, onApply } = await open();
    const field = screen.getByRole("textbox", { name: "Hex color" });
    await user.clear(field);
    await user.paste("#12ab34");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith("12AB34");
  });

  it("disables Apply while the hex code is invalid and keeps the preview", async () => {
    const { user, onApply } = await open();
    const field = screen.getByRole("textbox", { name: "Hex color" });
    await user.clear(field);
    await user.paste("12");
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByRole("group", { name: "Preview" })).toHaveTextContent("Kindle");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows the entry's label in the preview and closes on Cancel", async () => {
    const { user, onClose } = await open();
    expect(screen.getByRole("group", { name: "Preview" })).toHaveTextContent("Kindle");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
