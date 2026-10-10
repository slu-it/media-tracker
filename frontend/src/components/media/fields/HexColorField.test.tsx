import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { HexColorField } from "./HexColorField";

describe("HexColorField", () => {
  it("reports typed input normalised, with or without #", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<HexColorField value="" onChange={onChange} label="Hex" />);
    await user.click(screen.getByRole("textbox", { name: "Hex" }));
    await user.paste("#ab12cd");
    expect(onChange).toHaveBeenLastCalledWith("AB12CD");
  });

  it("shows the # adornment", () => {
    renderWithProviders(<HexColorField value="0070D1" onChange={() => {}} label="Hex" />);
    expect(screen.getByText("#")).toBeInTheDocument();
  });

  it("shows no error before the field is touched", () => {
    renderWithProviders(<HexColorField value="12" onChange={() => {}} label="Hex" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "false");
  });

  it("flags an invalid value once blurred", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HexColorField value="12" onChange={() => {}} label="Hex" />);
    await user.click(screen.getByRole("textbox"));
    await user.tab();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Must be exactly six hex digits (0-9, A-F)")).toBeInTheDocument();
  });

  it("flags an invalid value with showErrors and accepts a valid one", () => {
    const { rerender } = renderWithProviders(<HexColorField value="zz" onChange={() => {}} label="Hex" showErrors />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    rerender(<HexColorField value="0070D1" onChange={() => {}} label="Hex" showErrors />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "false");
  });
});
