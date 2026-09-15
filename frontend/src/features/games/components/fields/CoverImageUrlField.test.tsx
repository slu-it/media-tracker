import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/renderWithProviders";
import { CoverImageUrlField } from "./CoverImageUrlField";

describe("CoverImageUrlField", () => {
  it("accepts an empty value and shows the hint", () => {
    renderWithProviders(<CoverImageUrlField value="" onChange={() => {}} showErrors />);
    expect(screen.getByText("Optional. Leave empty for no cover.")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("rejects a relative URL after blur", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<CoverImageUrlField value="/relative.png" onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: /cover image url/i });
    expect(screen.queryByText("Must be an absolute http(s) URL")).not.toBeInTheDocument();
    await user.click(input);
    await user.tab();
    expect(screen.getByText("Must be an absolute http(s) URL")).toBeInTheDocument();
  });
});
