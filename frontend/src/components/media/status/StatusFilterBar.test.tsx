import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LibraryAddOutlinedIcon from "@mui/icons-material/LibraryAddOutlined";
import LibraryAddCheckOutlinedIcon from "@mui/icons-material/LibraryAddCheckOutlined";
import VideoLibraryOutlinedIcon from "@mui/icons-material/VideoLibraryOutlined";
import type { Ownership } from "../../../types/api";
import type { IconComponent } from "./iconComponent";

const OWNERSHIP_ICONS: Record<Ownership, IconComponent> = {
  watchlist: LibraryAddOutlinedIcon,
  subscription: VideoLibraryOutlinedIcon,
  owned: LibraryAddCheckOutlinedIcon,
};
import { renderWithProviders } from "../../../test/renderWithProviders";
import { StatusFilterBar } from "./StatusFilterBar";

const VALUES = ["watchlist", "subscription", "owned"] as const satisfies readonly Ownership[];
const LABELS: Record<Ownership, string> = { watchlist: "Wish", subscription: "Sub", owned: "Have" };

function setup(value: readonly Ownership[] = [], available: readonly Ownership[] | null = null, onChange = vi.fn()) {
  renderWithProviders(
    <StatusFilterBar
      values={VALUES}
      icons={OWNERSHIP_ICONS}
      getLabel={(v) => LABELS[v]}
      groupLabel="Status"
      value={value}
      onChange={onChange}
      available={available}
      dimmedHint="Nothing here"
    />,
  );
  return onChange;
}

describe("StatusFilterBar", () => {
  it("renders a labelled group with the buttons named by label, nothing pressed", () => {
    setup();

    const group = screen.getByRole("group", { name: "Status" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Wish", "Sub", "Have"]);
    for (const button of screen.getAllByRole("button")) expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the group name as a visible legend above the bar", () => {
    setup();

    const legend = screen.getByText("Status");
    expect(legend).toBeVisible();
    expect(legend.compareDocumentPosition(screen.getByRole("group", { name: "Status" }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("shows the value as pressed and reports toggles in values order", async () => {
    const onChange = setup(["owned"]);

    expect(screen.getByRole("button", { name: "Have" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Wish" }));
    expect(onChange).toHaveBeenLastCalledWith(["watchlist", "owned"]);

    await userEvent.click(screen.getByRole("button", { name: "Have" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("dims values that are not available but keeps them clickable", async () => {
    const onChange = setup([], ["owned"]);

    expect(screen.getByRole("button", { name: "Have" })).not.toHaveAttribute("data-dimmed");
    expect(screen.getByRole("button", { name: "Wish" })).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByRole("button", { name: "Wish" })).toHaveAttribute("aria-description", "Nothing here");
    expect(screen.getByRole("button", { name: "Have" })).not.toHaveAttribute("aria-description");

    await userEvent.click(screen.getByRole("button", { name: "Wish" }));
    expect(onChange).toHaveBeenLastCalledWith(["watchlist"]);
  });

  it("dims nothing while the available values are loading", () => {
    setup([], null);

    for (const button of screen.getAllByRole("button")) expect(button).not.toHaveAttribute("data-dimmed");
  });
});
