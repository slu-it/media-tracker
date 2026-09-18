import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { platforms as options } from "../../../../test/fixtures/games";
import { renderWithProviders } from "../../../../test/renderWithProviders";
import { PlatformsField } from "./PlatformsField";

describe("PlatformsField", () => {
  it("offers the platform labels and reports the id when selecting one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<PlatformsField value={[]} onChange={onChange} options={options} />);

    await user.click(screen.getByRole("combobox", { name: /platforms/i }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["PC", "PlayStation", "Xbox", "Nintendo"]);

    await user.click(screen.getByRole("option", { name: "Xbox" }));
    expect(onChange).toHaveBeenLastCalledWith(["platform-xbox"]);
  });

  it("reports both ids when two platforms end up selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = renderWithProviders(
      <PlatformsField value={["platform-pc"]} onChange={onChange} options={options} />,
    );

    await user.click(screen.getByRole("combobox", { name: /platforms/i }));
    await user.click(screen.getByRole("option", { name: "Xbox" }));
    expect(onChange).toHaveBeenLastCalledWith(["platform-pc", "platform-xbox"]);

    rerender(<PlatformsField value={["platform-pc", "platform-xbox"]} onChange={onChange} options={options} />);
    expect(screen.getByText("PC")).toBeInTheDocument();
    expect(screen.getByText("Xbox")).toBeInTheDocument();
  });

  it("shows the required error when asked to", () => {
    renderWithProviders(<PlatformsField value={[]} onChange={() => {}} options={options} showErrors />);
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("is disabled while options are still loading", () => {
    renderWithProviders(<PlatformsField value={[]} onChange={() => {}} options={null} />);
    expect(screen.getByRole("combobox", { name: /platforms/i })).toBeDisabled();
  });
});
