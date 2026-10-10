import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { flushAsync } from "../../test/flushAsync";
import { renderWithProviders } from "../../test/renderWithProviders";
import { AddSpeedDial, MAX_ADD_PRESETS } from "./AddSpeedDial";
import type { ColorChipItem } from "./ColorChip";

const options: ColorChipItem[] = ["A", "B", "C", "D", "E", "F", "G"].map((letter, index) => ({
  id: `id-${letter}`,
  label: `Option ${letter}`,
  associatedColor: index % 2 === 0 ? "000000" : "FFFFFF",
}));

/** The action labels in DOM order. */
const labels = () => screen.getAllByText(/^Option /).map((element) => element.textContent);

describe("AddSpeedDial", () => {
  it("is disabled and offers no actions while the options are loading", () => {
    renderWithProviders(<AddSpeedDial label="Add thing" options={null} onAdd={() => {}} />);
    expect(screen.getByRole("button", { name: "Add thing" })).toBeDisabled();
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });

  it("puts the most used option first, i.e. closest to the button of the upward dial, ties in API order", () => {
    const counts = { "id-C": 9, "id-B": 4, "id-D": 4, "id-A": 1 };
    renderWithProviders(<AddSpeedDial label="Add thing" options={options} counts={counts} onAdd={() => {}} />);
    // The dial opens upward in a column-reverse flex box: the first DOM child is the one nearest the button.
    expect(labels()).toEqual(["Option C", "Option B", "Option D", "Option A", "Option E"]);
  });

  it("keeps API order without counts and caps the actions", () => {
    renderWithProviders(<AddSpeedDial label="Add thing" options={options} onAdd={() => {}} />);
    expect(labels()).toEqual(options.slice(0, MAX_ADD_PRESETS).map((option) => option.label));
  });

  it("colors an action from the option color with a contrasting text", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddSpeedDial label="Add thing" options={options} onAdd={() => {}} />, { realStyles: true });
    await user.hover(screen.getByRole("button", { name: "Add thing" }));
    await flushAsync();

    const dark = screen.getByRole("menuitem", { name: "Option A" });
    expect(dark).toHaveStyle({ backgroundColor: "rgb(0, 0, 0)", color: "rgb(255, 255, 255)" });
    const light = screen.getByRole("menuitem", { name: "Option B" });
    expect(light).toHaveStyle({ backgroundColor: "rgb(255, 255, 255)", color: "rgba(0, 0, 0, 0.87)" });
  });

  it("adds with the option id when an action is clicked", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderWithProviders(<AddSpeedDial label="Add thing" options={options} onAdd={onAdd} />);
    await user.hover(screen.getByRole("button", { name: "Add thing" }));
    await flushAsync();
    expect(screen.getByRole("button", { name: "Add thing" })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("menuitem", { name: "Option B" }));
    expect(onAdd).toHaveBeenCalledExactlyOnceWith("id-B");
  });

  it("adds without a preset when the button itself is clicked", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderWithProviders(<AddSpeedDial label="Add thing" options={options} onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: "Add thing" }));
    expect(onAdd).toHaveBeenCalledExactlyOnceWith();
  });

  it("exposes no menu items to assistive tech while closed", () => {
    renderWithProviders(<AddSpeedDial label="Add thing" options={options} onAdd={() => {}} />);
    expect(screen.queryByRole("menuitem", { name: "Option A" })).not.toBeInTheDocument();
  });

  it("adds without a preset on Enter after Tab", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderWithProviders(<AddSpeedDial label="Add thing" options={options} onAdd={onAdd} />);

    await user.tab();
    await flushAsync();
    expect(screen.getByRole("button", { name: "Add thing" })).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Enter}");
    expect(onAdd).toHaveBeenCalledExactlyOnceWith();
  });

  it("only opens on Enter after Escape closed it, without adding", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderWithProviders(<AddSpeedDial label="Add thing" options={options} onAdd={onAdd} />);
    const fab = screen.getByRole("button", { name: "Add thing" });

    await user.tab();
    await flushAsync();
    await user.keyboard("{Escape}");
    expect(fab).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Enter}");
    expect(fab).toHaveAttribute("aria-expanded", "true");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("does not reopen when focus returns to the button, e.g. after the add dialog closed", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderWithProviders(<AddSpeedDial label="Add thing" options={options} onAdd={onAdd} />);
    const fab = screen.getByRole("button", { name: "Add thing" });

    await user.click(fab);
    expect(onAdd).toHaveBeenCalledOnce();
    fab.blur();
    await flushAsync();
    fab.focus();
    await flushAsync();
    expect(fab).toHaveAttribute("aria-expanded", "false");
  });

  it.each(["touch", "pen"])("keeps the first %s tap from adding; a second tap adds", async (pointerType) => {
    const onAdd = vi.fn();
    renderWithProviders(<AddSpeedDial label="Add thing" options={options} onAdd={onAdd} />);
    const fab = screen.getByRole("button", { name: "Add thing" });

    fireEvent.pointerDown(fab, { pointerType });
    fireEvent.mouseEnter(fab);
    await flushAsync();
    fireEvent.click(fab);
    expect(onAdd).not.toHaveBeenCalled();
    expect(fab).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(fab, { pointerType });
    fireEvent.click(fab);
    expect(onAdd).toHaveBeenCalledExactlyOnceWith();
  });

  it("adds on a mouse click that arrives before the hover-open timer fired", () => {
    const onAdd = vi.fn();
    renderWithProviders(<AddSpeedDial label="Add thing" options={options} onAdd={onAdd} />);
    const fab = screen.getByRole("button", { name: "Add thing" });

    fireEvent.pointerDown(fab, { pointerType: "mouse" });
    fireEvent.click(fab);
    expect(onAdd).toHaveBeenCalledExactlyOnceWith();
    expect(fab).toHaveAttribute("aria-expanded", "false");
  });
});
