import { describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { OWNERSHIP_ICONS } from "./ownershipIcons";
import { StatusToggleBar } from "./StatusToggleBar";
import type { Ownership } from "../domain/gameStatus";

const VALUES = ["watchlist", "owned"] as const satisfies readonly Ownership[];
const LABELS: Record<Ownership, string> = { watchlist: "Wish", subscription: "Sub", owned: "Have" };

function multi(overrides: { value?: readonly Ownership[]; onChange?: (next: Ownership[]) => void } = {}) {
  return (
    <StatusToggleBar<Ownership>
      multiple
      values={VALUES}
      icons={OWNERSHIP_ICONS}
      getLabel={(v) => LABELS[v]}
      groupLabel="Ownership group"
      value={overrides.value ?? []}
      onChange={overrides.onChange ?? vi.fn()}
    />
  );
}

describe("StatusToggleBar multiple", () => {
  it("shows nothing pressed for an empty selection and renders each icon", () => {
    renderWithProviders(multi());
    expect(screen.getByRole("group", { name: "Ownership group" })).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Wish", "Have"]);
    for (const button of buttons) expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("LibraryAddOutlinedIcon")).toBeInTheDocument();
    expect(screen.getByTestId("LibraryAddCheckOutlinedIcon")).toBeInTheDocument();
  });

  it("reports an added value in values order, not click order", async () => {
    const onChange = vi.fn();
    renderWithProviders(multi({ value: ["owned"], onChange }));
    await userEvent.click(screen.getByRole("button", { name: "Wish" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["watchlist", "owned"]);
  });

  it("reports a single added value", async () => {
    const onChange = vi.fn();
    renderWithProviders(multi({ onChange }));
    await userEvent.click(screen.getByRole("button", { name: "Have" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["owned"]);
  });

  it("removes a pressed value and reports an empty selection after the last one", async () => {
    const onChange = vi.fn();
    const { rerender } = renderWithProviders(multi({ value: ["watchlist", "owned"], onChange }));
    await userEvent.click(screen.getByRole("button", { name: "Wish" }));
    expect(onChange).toHaveBeenLastCalledWith(["owned"]);
    rerender(multi({ value: ["owned"], onChange }));
    await userEvent.click(screen.getByRole("button", { name: "Have" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("marks dimmed buttons only, describes and hints them, keeps them clickable and named by the plain label", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <StatusToggleBar<Ownership>
        multiple
        values={VALUES}
        icons={OWNERSHIP_ICONS}
        getLabel={(v) => LABELS[v]}
        groupLabel="Ownership group"
        value={[]}
        onChange={onChange}
        dimmed={(v) => v === "owned"}
        dimmedHint="Empty"
      />,
    );
    expect(screen.getByRole("button", { name: "Have" })).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByRole("button", { name: "Have" })).toHaveAttribute("aria-description", "Empty");
    expect(screen.getByRole("button", { name: "Wish" })).not.toHaveAttribute("data-dimmed");
    expect(screen.getByRole("button", { name: "Wish" })).not.toHaveAttribute("aria-description");
    await userEvent.hover(screen.getByRole("button", { name: "Have" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Have · Empty");
    await userEvent.click(screen.getByRole("button", { name: "Have" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["owned"]);
  });

  it("never dims a pressed button visually but keeps its description", () => {
    renderWithProviders(
      <StatusToggleBar<Ownership>
        multiple
        values={VALUES}
        icons={OWNERSHIP_ICONS}
        getLabel={(v) => LABELS[v]}
        groupLabel="Ownership group"
        value={["owned"]}
        onChange={vi.fn()}
        dimmed={() => true}
        dimmedHint="Empty"
      />,
    );
    const pressed = screen.getByRole("button", { name: "Have" });
    expect(pressed).toHaveAttribute("aria-pressed", "true");
    expect(pressed).not.toHaveAttribute("data-dimmed");
    expect(pressed).toHaveAttribute("aria-description", "Empty");
    expect(getComputedStyle(pressed).opacity).not.toBe("0.5");
    const unpressed = screen.getByRole("button", { name: "Wish" });
    expect(unpressed).toHaveAttribute("data-dimmed", "true");
    expect(getComputedStyle(unpressed).opacity).toBe("0.5");
  });

  it("colours pressed buttons with the primary colour", () => {
    renderWithProviders(multi({ value: ["owned"] }));
    expect(screen.getByRole("button", { name: "Have" })).toHaveClass("MuiToggleButton-primary", "Mui-selected");
  });

  it("toggles a focused button with Space", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(multi({ onChange }));
    await user.tab();
    expect(screen.getByRole("button", { name: "Wish" })).toHaveFocus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["watchlist"]);
  });

  it("ignores Enter and Space on a focused button while disabled", async () => {
    const user = userEvent.setup();
    const errors = vi.spyOn(console, "error");
    const onChange = vi.fn();
    renderWithProviders(
      <StatusToggleBar<Ownership>
        multiple
        values={VALUES}
        icons={OWNERSHIP_ICONS}
        getLabel={(v) => LABELS[v]}
        groupLabel="Ownership group"
        value={[]}
        onChange={onChange}
        disabled
      />,
    );
    // MUI's ButtonBase takes aria-disabled buttons out of the tab order, so Tab skips them; focus one
    // programmatically to prove the keys are ignored even if focus got there anyway.
    await user.tab();
    for (const button of screen.getAllByRole("button")) expect(button).not.toHaveFocus();
    const first = screen.getAllByRole("button")[0];
    act(() => first.focus());
    expect(first).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onChange).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it("blocks changes while disabled and is marked busy", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <StatusToggleBar<Ownership>
        multiple
        values={VALUES}
        icons={OWNERSHIP_ICONS}
        getLabel={(v) => LABELS[v]}
        groupLabel="Ownership group"
        value={[]}
        onChange={onChange}
        disabled
      />,
    );
    expect(screen.getByRole("group", { name: "Ownership group" })).toHaveAttribute("aria-busy", "true");
    await userEvent.click(screen.getByRole("button", { name: "Wish" }), { pointerEventsCheck: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("StatusToggleBar single", () => {
  it("is exclusive: reports a new value and ignores the pressed one", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <StatusToggleBar<Ownership>
        values={VALUES}
        icons={OWNERSHIP_ICONS}
        getLabel={(v) => LABELS[v]}
        groupLabel="Ownership group"
        value="owned"
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Have" }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Wish" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("watchlist");
  });
});
