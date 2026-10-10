import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { VocabularyNameField } from "./VocabularyNameField";

describe("VocabularyNameField", () => {
  it("reports typed input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<VocabularyNameField value="" onChange={onChange} label="Name" />);
    await user.type(screen.getByRole("textbox", { name: "Name" }), "A");
    expect(onChange).toHaveBeenCalledWith("A");
  });

  it("shows no error before the field is touched", () => {
    renderWithProviders(<VocabularyNameField value="" onChange={() => {}} label="Name" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "false");
  });

  it("reports an empty name with showErrors", () => {
    renderWithProviders(<VocabularyNameField value="  " onChange={() => {}} label="Name" showErrors />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("reports a too-long name once blurred", async () => {
    const user = userEvent.setup();
    renderWithProviders(<VocabularyNameField value={"x".repeat(129)} onChange={() => {}} label="Name" />);
    await user.click(screen.getByRole("textbox"));
    await user.tab();
    expect(screen.getByText("At most 128 characters")).toBeInTheDocument();
  });
});
