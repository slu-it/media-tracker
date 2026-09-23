import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { CoverImage } from "./CoverImage";

describe("CoverImage", () => {
  it("shows the placeholder without a source", () => {
    renderWithProviders(<CoverImage src={null} alt="Celeste" width={100} height={140} />);
    expect(screen.queryByRole("img", { name: "Celeste" })).not.toBeInTheDocument();
    expect(screen.getByTitle("No cover image")).toBeInTheDocument();
  });

  it("shows no button without a source and without a click handler", () => {
    renderWithProviders(<CoverImage src={null} alt="Celeste" width={100} height={140} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByTitle("No cover image")).toBeInTheDocument();
  });

  it("shows no button with a source and without a click handler", () => {
    renderWithProviders(<CoverImage src="https://img.example/c.png" alt="Celeste" width={100} height={140} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Celeste" })).toBeInTheDocument();
  });

  it("wraps the placeholder in a button that calls the handler when there is no source", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(
      <CoverImage
        src={null}
        alt="Celeste"
        width={100}
        height={140}
        onClick={onClick}
        actionLabel="Choose a cover image"
      />,
    );
    const button = screen.getByRole("button", { name: "Choose a cover image" });
    expect(screen.getByTitle("No cover image")).toBeInTheDocument();
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("wraps the image in a button that calls the handler when there is a source", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(
      <CoverImage
        src="https://img.example/c.png"
        alt="Celeste"
        width={100}
        height={140}
        onClick={onClick}
        actionLabel="Choose a cover image"
      />,
    );
    const button = screen.getByRole("button", { name: "Choose a cover image" });
    expect(screen.getByRole("img", { name: "Celeste" })).toBeInTheDocument();
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
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
