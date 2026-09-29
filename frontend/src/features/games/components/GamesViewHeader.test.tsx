import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GamesViewHeader } from "./GamesViewHeader";

describe("GamesViewHeader", () => {
  it("renders the controls row", () => {
    renderWithProviders(<GamesViewHeader controls={<button type="button">Filter</button>} count={null} />);
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
  });

  it("renders the search row when given", () => {
    renderWithProviders(
      <GamesViewHeader
        controls={<button type="button">Filter</button>}
        search={<input aria-label="Search" />}
        count={null}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
  });

  it("omits the search row when not given", () => {
    renderWithProviders(<GamesViewHeader controls={<button type="button">Filter</button>} count={null} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders the search row before the controls row", () => {
    renderWithProviders(
      <GamesViewHeader
        controls={<button type="button">Filter</button>}
        search={<input aria-label="Search" />}
        count={null}
      />,
    );
    const search = screen.getByRole("textbox", { name: "Search" });
    const controlsButton = screen.getByRole("button", { name: "Filter" });
    const position = search.compareDocumentPosition(controlsButton);
    expect(position === Node.DOCUMENT_POSITION_FOLLOWING).toBe(true);
  });

  it("renders the controls for each layout", () => {
    for (const controlsLayout of ["fill", "half", "center"] as const) {
      const { unmount } = renderWithProviders(
        <GamesViewHeader
          controls={<button type="button">Filter</button>}
          controlsLayout={controlsLayout}
          count={null}
        />,
      );
      expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
      unmount();
    }
  });

  it("shows the result count", () => {
    renderWithProviders(<GamesViewHeader controls={<button type="button">Filter</button>} count={3} />);
    expect(screen.getByRole("status")).toHaveTextContent("3 games");
  });

  it("renders the pagination slot", () => {
    renderWithProviders(
      <GamesViewHeader
        controls={<button type="button">Filter</button>}
        count={3}
        pagination={<button type="button">Page 2</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
  });

  it("ends with a separator", () => {
    renderWithProviders(<GamesViewHeader controls={<button type="button">Filter</button>} count={null} />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("keeps the status region present with the zero-count announcement and drops the pagination slot when count is 0", () => {
    renderWithProviders(
      <GamesViewHeader
        controls={<button type="button">Filter</button>}
        count={0}
        pagination={<button type="button">Page 2</button>}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("0 games");
    expect(screen.queryByRole("button", { name: "Page 2" })).not.toBeInTheDocument();
  });
});
