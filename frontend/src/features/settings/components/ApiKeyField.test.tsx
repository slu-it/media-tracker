import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { MASKED_VALUE } from "../domain/apiKeyMask";
import { ApiKeyField } from "./ApiKeyField";

const KEY = "11111111-1111-1111-1111-111111111111";

describe("ApiKeyField", () => {
  it("masks the key by default and reveals it on demand", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApiKeyField label="Primary key" value={KEY} busy={false} onRegenerate={() => {}} />);
    const field = screen.getByRole("textbox", { name: "Primary key" });
    expect(field).toHaveValue(MASKED_VALUE);
    expect(field).not.toHaveValue(KEY);

    await user.click(screen.getByRole("button", { name: "Show Primary key" }));
    expect(field).toHaveValue(KEY);
    await user.click(screen.getByRole("button", { name: "Hide Primary key" }));
    expect(field).toHaveValue(MASKED_VALUE);
  });

  it("masks the field again after the key value changes", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <ApiKeyField label="Primary key" value={KEY} busy={false} onRegenerate={() => {}} />,
    );

    await user.click(screen.getByRole("button", { name: "Show Primary key" }));
    expect(screen.getByRole("textbox", { name: "Primary key" })).toHaveValue(KEY);

    const NEW_KEY = "22222222-2222-2222-2222-222222222222";
    rerender(<ApiKeyField label="Primary key" value={NEW_KEY} busy={false} onRegenerate={() => {}} />);
    expect(screen.getByRole("textbox", { name: "Primary key" })).toHaveValue(MASKED_VALUE);
  });

  it("shows the placeholder and disables reveal when there is no key", () => {
    renderWithProviders(<ApiKeyField label="Primary key" value={null} busy={false} onRegenerate={() => {}} />);
    expect(screen.getByRole("textbox", { name: "Primary key" })).toHaveValue("");
    expect(screen.getByPlaceholderText("No key generated yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Primary key" })).toBeDisabled();
  });

  it("copies the key to the clipboard and shows the copied feedback", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApiKeyField label="Primary key" value={KEY} busy={false} onRegenerate={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Copy Primary key" }));
    expect(await navigator.clipboard.readText()).toBe(KEY);
    expect(await screen.findByRole("button", { name: "Copied Primary key" })).toBeInTheDocument();
  });

  it("disables the copy button when there is no key", () => {
    renderWithProviders(<ApiKeyField label="Primary key" value={null} busy={false} onRegenerate={() => {}} />);
    expect(screen.getByRole("button", { name: "Copy Primary key" })).toBeDisabled();
  });

  describe("without the Clipboard API", () => {
    let original: PropertyDescriptor | undefined;

    beforeEach(() => {
      original = Object.getOwnPropertyDescriptor(window.navigator, "clipboard");
    });

    afterEach(() => {
      if (original) Object.defineProperty(window.navigator, "clipboard", original);
      else Reflect.deleteProperty(window.navigator, "clipboard");
    });

    it("reveals and selects the key instead of copying it", async () => {
      // userEvent.setup() attaches its own clipboard stub, so the override must happen after.
      const user = userEvent.setup();
      Object.defineProperty(window.navigator, "clipboard", { value: undefined, configurable: true });
      renderWithProviders(<ApiKeyField label="Primary key" value={KEY} busy={false} onRegenerate={() => {}} />);
      const field = screen.getByRole<HTMLInputElement>("textbox", { name: "Primary key" });
      expect(field).toHaveValue(MASKED_VALUE);

      await user.click(screen.getByRole("button", { name: "Copy Primary key" }));
      await waitFor(() => expect(field).toHaveValue(KEY));
      expect(field.selectionStart).toBe(0);
      expect(field.selectionEnd).toBe(KEY.length);
    });

    it("reveals and selects the key when the clipboard write is rejected", async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockRejectedValue(new Error("denied"));
      Object.defineProperty(window.navigator, "clipboard", { value: { writeText }, configurable: true });
      renderWithProviders(<ApiKeyField label="Primary key" value={KEY} busy={false} onRegenerate={() => {}} />);
      const field = screen.getByRole<HTMLInputElement>("textbox", { name: "Primary key" });
      expect(field).toHaveValue(MASKED_VALUE);

      await user.click(screen.getByRole("button", { name: "Copy Primary key" }));
      await waitFor(() => expect(field).toHaveValue(KEY));
      expect(field.selectionStart).toBe(0);
      expect(field.selectionEnd).toBe(KEY.length);
    });
  });

  it("regenerates immediately when there is no key yet", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    renderWithProviders(<ApiKeyField label="Primary key" value={null} busy={false} onRegenerate={onRegenerate} />);
    await user.click(screen.getByRole("button", { name: "Generate Primary key" }));
    expect(onRegenerate).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks for confirmation before regenerating an existing key, and only regenerates on Yes", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    renderWithProviders(<ApiKeyField label="Primary key" value={KEY} busy={false} onRegenerate={onRegenerate} />);

    await user.click(screen.getByRole("button", { name: "Regenerate Primary key" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "No" }));
    expect(onRegenerate).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Regenerate Primary key" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it("disables the regenerate button while busy", () => {
    renderWithProviders(<ApiKeyField label="Primary key" value={KEY} busy onRegenerate={() => {}} />);
    expect(screen.getByRole("button", { name: "Regenerate Primary key" })).toBeDisabled();
  });
});
