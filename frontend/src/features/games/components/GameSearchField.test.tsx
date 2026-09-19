import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GameSearchField } from "./GameSearchField";

describe("GameSearchField", () => {
  it("shows the clear button only while there is text", () => {
    const { rerender } = renderWithProviders(<GameSearchField value="" onChange={() => {}} onClear={() => {}} />);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

    rerender(<GameSearchField value="hades" onChange={() => {}} onClear={() => {}} />);
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });

  it("reports typed text and clearing to the callbacks", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClear = vi.fn();
    const { rerender } = renderWithProviders(<GameSearchField value="" onChange={onChange} onClear={onClear} />);
    const input = screen.getByRole("searchbox", { name: "Search games" });
    await user.click(input);
    await user.paste("hades");
    expect(onChange).toHaveBeenCalledWith("hades");

    rerender(<GameSearchField value="hades" onChange={onChange} onClear={onClear} />);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalled();
  });
});
