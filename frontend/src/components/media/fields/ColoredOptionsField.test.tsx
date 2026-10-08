import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { pc, platforms as options, xbox } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { ColoredOptionsField } from "./ColoredOptionsField";

describe("ColoredOptionsField", () => {
  it("offers the platform labels and reports the id when selecting one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <ColoredOptionsField label="Platforms" required value={[]} onChange={onChange} options={options} />,
    );

    await user.click(screen.getByRole("combobox", { name: /platforms/i }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["PC", "PlayStation", "Xbox", "Nintendo"]);

    await user.click(screen.getByRole("option", { name: "Xbox" }));
    expect(onChange).toHaveBeenLastCalledWith([xbox.id]);
  });

  it("reports both ids when two platforms end up selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = renderWithProviders(
      <ColoredOptionsField label="Platforms" required value={[pc.id]} onChange={onChange} options={options} />,
    );

    await user.click(screen.getByRole("combobox", { name: /platforms/i }));
    await user.click(screen.getByRole("option", { name: "Xbox" }));
    expect(onChange).toHaveBeenLastCalledWith([pc.id, xbox.id]);
    // Multi-select keeps the listbox open after a pick; close it so the rerendered chips are the only "Xbox" match.
    await user.keyboard("{Escape}");

    rerender(
      <ColoredOptionsField label="Platforms" required value={[pc.id, xbox.id]} onChange={onChange} options={options} />,
    );
    expect(screen.getByText("PC")).toBeInTheDocument();
    expect(screen.getByText("Xbox")).toBeInTheDocument();
  });

  it("shows the required error when asked to", () => {
    renderWithProviders(
      <ColoredOptionsField label="Platforms" required value={[]} onChange={() => {}} options={options} showErrors />,
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("accepts an empty selection and shows no required error when not required", () => {
    renderWithProviders(
      <ColoredOptionsField
        label="Types"
        required={false}
        value={[]}
        onChange={() => {}}
        options={options}
        showErrors
      />,
    );
    expect(screen.queryByText("Required")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Types" })).not.toBeRequired();
  });

  it("is disabled while options are still loading", () => {
    renderWithProviders(
      <ColoredOptionsField label="Platforms" required value={[]} onChange={() => {}} options={null} />,
    );
    expect(screen.getByRole("combobox", { name: /platforms/i })).toBeDisabled();
  });
});
