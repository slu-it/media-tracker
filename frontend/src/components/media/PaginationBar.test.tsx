import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { PaginationBar } from "./PaginationBar";

describe("PaginationBar", () => {
  it("changes the page and scrolls the window to the top", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo");
    const onPageChange = vi.fn();
    renderWithProviders(<PaginationBar page={1} totalItems={100} totalPages={3} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: "Go to page 2" }));

    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(2);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0 });
  });

  it("neither changes the page nor scrolls when the current page is clicked", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo");
    const onPageChange = vi.fn();
    renderWithProviders(<PaginationBar page={1} totalItems={100} totalPages={3} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: "page 1" }));

    expect(onPageChange).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
