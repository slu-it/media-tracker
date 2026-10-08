import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { hardcover, kindle, meta } from "../../../test/fixtures/books";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { EMPTY_BOOK_FILTERS } from "../domain/bookFilters";
import { BookFilterBar } from "./BookFilterBar";

describe("BookFilterBar", () => {
  it("shows the placeholder for every filter when nothing is selected", () => {
    renderWithProviders(<BookFilterBar filters={EMPTY_BOOK_FILTERS} onChange={() => {}} meta={meta} />);

    expect(screen.getByRole("combobox", { name: "Type" })).toHaveTextContent("-all-");
    expect(screen.getByRole("combobox", { name: "Release year" })).toHaveTextContent("-all-");
  });

  it("offers the values from the meta payload", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BookFilterBar filters={EMPTY_BOOK_FILTERS} onChange={() => {}} meta={meta} />);

    await user.click(screen.getByRole("combobox", { name: "Type" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Hardcover", "Kindle"]);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("combobox", { name: "Release year" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["1968", "1965"]);
  });

  it("reports both values once two are selected in one filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <BookFilterBar filters={{ ...EMPTY_BOOK_FILTERS, typeIds: [kindle.id] }} onChange={onChange} meta={meta} />,
    );

    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.click(screen.getByRole("option", { name: "Hardcover" }));

    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_BOOK_FILTERS, typeIds: [kindle.id, hardcover.id] });
  });

  it("disables a filter without values and every filter while loading", () => {
    const { unmount } = renderWithProviders(
      <BookFilterBar filters={EMPTY_BOOK_FILTERS} onChange={() => {}} meta={{ ...meta, releaseYears: [] }} />,
    );
    expect(screen.getByRole("combobox", { name: "Release year" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("combobox", { name: "Type" })).not.toHaveAttribute("aria-disabled");
    unmount();

    renderWithProviders(<BookFilterBar filters={EMPTY_BOOK_FILTERS} onChange={() => {}} meta={null} />);
    expect(screen.getByRole("combobox", { name: "Type" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("combobox", { name: "Release year" })).toHaveAttribute("aria-disabled", "true");
  });
});
