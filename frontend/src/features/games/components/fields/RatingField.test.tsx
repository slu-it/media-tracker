import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../../test/renderWithProviders";
import { RatingField } from "./RatingField";

// MUI's Rating computes the clicked value from the star's bounding box, which jsdom always reports as
// zero-sized, so clicking a star cannot be exercised meaningfully here; the null/rated states are covered instead.
describe("RatingField", () => {
  it("shows 'not rated yet' when there is no rating", () => {
    renderWithProviders(<RatingField value={null} onChange={() => {}} />);
    expect(screen.getByText("Not rated yet")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Rating" })).toBeInTheDocument();
  });

  it("shows the numeric value when rated", () => {
    renderWithProviders(<RatingField value={4.5} onChange={() => {}} />);
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.queryByText("Not rated yet")).not.toBeInTheDocument();
  });

  it("shows the invalid-rating error with showErrors", () => {
    renderWithProviders(<RatingField value={6} onChange={() => {}} showErrors />);
    expect(screen.getByText("Must be between 0.25 and 5 in steps of 0.25")).toBeInTheDocument();
  });

  it("does not show an error for a valid rating", () => {
    renderWithProviders(<RatingField value={4.5} onChange={() => {}} showErrors />);
    expect(screen.queryByText("Must be between 0.25 and 5 in steps of 0.25")).not.toBeInTheDocument();
  });
});
