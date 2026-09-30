import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { flushAsync } from "../../../test/flushAsync";
import { OwnershipSwitch } from "./OwnershipSwitch";

describe("OwnershipSwitch", () => {
  it("is a switch named Owned, unchecked for watchlist", () => {
    renderWithProviders(<OwnershipSwitch value="watchlist" onChange={vi.fn()} />);
    expect(screen.getByRole("switch", { name: "Owned" })).not.toBeChecked();
  });

  it("is checked for owned", () => {
    renderWithProviders(<OwnershipSwitch value="owned" onChange={vi.fn()} />);
    expect(screen.getByRole("switch", { name: "Owned" })).toBeChecked();
  });

  it("reports the opposite value on click", async () => {
    const onChange = vi.fn();
    const { unmount } = renderWithProviders(<OwnershipSwitch value="watchlist" onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("owned");
    unmount();
    const back = vi.fn();
    renderWithProviders(<OwnershipSwitch value="owned" onChange={back} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(back).toHaveBeenCalledExactlyOnceWith("watchlist");
  });

  it("reports the opposite value on Space", async () => {
    const onChange = vi.fn();
    renderWithProviders(<OwnershipSwitch value="watchlist" onChange={onChange} />);
    screen.getByRole("switch").focus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("owned");
    await flushAsync();
  });

  it.each([
    ["watchlist", "Watchlist"],
    ["owned", "Owned"],
  ] as const)("shows the %s state as tooltip on hover", async (value, label) => {
    renderWithProviders(<OwnershipSwitch value={value} onChange={vi.fn()} />);
    await userEvent.hover(screen.getByRole("switch"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(label);
    expect(screen.queryAllByLabelText("Watchlist")).toHaveLength(0);
    await flushAsync();
  });

  it("names the group Ownership exactly once with showLabel", () => {
    renderWithProviders(<OwnershipSwitch value="watchlist" onChange={vi.fn()} showLabel />);
    expect(screen.getByRole("group", { name: "Ownership" })).toBeInTheDocument();
    expect(screen.getAllByText("Ownership")).toHaveLength(1);
  });

  it("names the group by an external label", () => {
    renderWithProviders(
      <>
        <span id="ext">Mine</span>
        <OwnershipSwitch value="watchlist" onChange={vi.fn()} aria-labelledby="ext" />
      </>,
    );
    expect(screen.getByRole("group", { name: "Mine" })).toBeInTheDocument();
  });

  it("shows the icon of the current state in the thumb", () => {
    const { unmount } = renderWithProviders(<OwnershipSwitch value="watchlist" onChange={vi.fn()} />);
    expect(screen.getByTestId("LibraryAddOutlinedIcon")).toBeInTheDocument();
    expect(screen.queryByTestId("LibraryAddCheckOutlinedIcon")).not.toBeInTheDocument();
    unmount();
    renderWithProviders(<OwnershipSwitch value="owned" onChange={vi.fn()} />);
    expect(screen.getByTestId("LibraryAddCheckOutlinedIcon")).toBeInTheDocument();
    expect(screen.queryByTestId("LibraryAddOutlinedIcon")).not.toBeInTheDocument();
  });

  it("blocks changes while busy and is marked busy", async () => {
    const onChange = vi.fn();
    renderWithProviders(<OwnershipSwitch value="watchlist" onChange={onChange} disabled />);
    expect(screen.getByRole("group", { name: "Ownership" })).toHaveAttribute("aria-busy", "true");
    const toggle = screen.getByRole("switch");
    await userEvent.click(toggle, { pointerEventsCheck: 0 });
    toggle.focus();
    await userEvent.keyboard(" ");
    expect(onChange).not.toHaveBeenCalled();
    expect(toggle).not.toBeChecked();
    await flushAsync();
  });
});
