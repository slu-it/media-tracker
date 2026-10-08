import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { meta } from "../../../test/fixtures/books";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { EMPTY_BOOK_FILTERS, type BookFilters } from "../domain/bookFilters";
import { BookStatusFilterToggles } from "./BookStatusFilterToggles";

function setupToggles(
  filters: BookFilters = EMPTY_BOOK_FILTERS,
  metaValue: typeof meta | null = meta,
  onChange = vi.fn(),
) {
  renderWithProviders(<BookStatusFilterToggles filters={filters} onChange={onChange} meta={metaValue} />);
  return onChange;
}

const progressGroup = () => screen.getByRole("group", { name: "Progress" });
const ownershipGroup = () => screen.getByRole("group", { name: "Ownership" });
const labels = (group: HTMLElement) =>
  within(group)
    .getAllByRole("button")
    .map((b) => b.getAttribute("aria-label"));

describe("BookStatusFilterToggles", () => {
  it("renders a progress group then an ownership group, nothing pressed", () => {
    setupToggles();

    expect(screen.getAllByRole("group")).toEqual([progressGroup(), ownershipGroup()]);
    expect(labels(progressGroup())).toEqual(["Abandoned", "Not started", "Paused", "Reading", "Finished"]);
    expect(labels(ownershipGroup())).toEqual(["Watchlist", "Owned"]);
    for (const button of screen.getAllByRole("button")) expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the filtered values as pressed", () => {
    setupToggles({ ...EMPTY_BOOK_FILTERS, progress: ["reading", "paused"], ownership: ["owned"] });

    expect(screen.getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Paused" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Finished" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Owned" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reports a progress toggle merged into the filters, in values order", async () => {
    const base: BookFilters = { ...EMPTY_BOOK_FILTERS, typeIds: ["t1"], progress: ["finished"], ownership: ["owned"] };
    const onChange = setupToggles(base);

    await userEvent.click(screen.getByRole("button", { name: "Reading" }));

    expect(onChange).toHaveBeenLastCalledWith({ ...base, progress: ["reading", "finished"] });
  });

  it("reports an ownership toggle and an untoggle back to none", async () => {
    const onChange = setupToggles({ ...EMPTY_BOOK_FILTERS, ownership: ["owned"] });

    await userEvent.click(screen.getByRole("button", { name: "Watchlist" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_BOOK_FILTERS, ownership: ["watchlist", "owned"] });

    await userEvent.click(screen.getByRole("button", { name: "Owned" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_BOOK_FILTERS, ownership: [] });
  });

  it("dims values absent from the meta payload but keeps them clickable", async () => {
    const onChange = setupToggles(EMPTY_BOOK_FILTERS, { ...meta, ownership: ["owned"], progress: ["reading"] });

    expect(screen.getByRole("button", { name: "Reading" })).not.toHaveAttribute("data-dimmed");
    expect(screen.getByRole("button", { name: "Paused" })).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByRole("button", { name: "Paused" })).toHaveAttribute("aria-description", "No books");
    expect(screen.getByRole("button", { name: "Watchlist" })).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByRole("button", { name: "Owned" })).not.toHaveAttribute("data-dimmed");

    await userEvent.click(screen.getByRole("button", { name: "Paused" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_BOOK_FILTERS, progress: ["paused"] });
  });

  it("dims nothing while the meta payload is loading", () => {
    setupToggles(EMPTY_BOOK_FILTERS, null);

    for (const button of screen.getAllByRole("button")) expect(button).not.toHaveAttribute("data-dimmed");
  });
});
