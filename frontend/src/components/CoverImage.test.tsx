import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { CoverImage } from "./CoverImage";

describe("CoverImage", () => {
  it("shows the placeholder without a source", () => {
    renderWithProviders(<CoverImage src={null} alt="Celeste" width={100} height={140} />);
    expect(screen.queryByRole("img", { name: "Celeste" })).not.toBeInTheDocument();
    expect(screen.getByTitle("No cover image")).toBeInTheDocument();
  });

  it("renders the image and falls back to the placeholder when it fails to load", () => {
    renderWithProviders(<CoverImage src="https://img.example/c.png" alt="Celeste" width={100} height={140} />);
    const img = screen.getByRole("img", { name: "Celeste" });
    expect(img).toHaveAttribute("src", "https://img.example/c.png");
    expect(img).toHaveStyle({ objectFit: "contain" });
    fireEvent.error(img);
    expect(screen.queryByRole("img", { name: "Celeste" })).not.toBeInTheDocument();
    expect(screen.getByTitle("No cover image")).toBeInTheDocument();
  });
});
