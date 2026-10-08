import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { MediaCardShell } from "./MediaCardShell";

describe("MediaCardShell", () => {
  it("renders the children slot below the title", () => {
    renderWithProviders(
      <MediaCardShell title="Celeste" coverImageUrl={null} onClick={() => {}}>
        <span>card body</span>
      </MediaCardShell>,
    );

    const title = screen.getByText("Celeste");
    const body = screen.getByText("card body");
    expect(body).toBeInTheDocument();
    expect(title.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("calls onClick when the card is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(<MediaCardShell title="Celeste" coverImageUrl={null} onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Celeste" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("calls onClick when the card is activated by keyboard", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(<MediaCardShell title="Celeste" coverImageUrl={null} onClick={onClick} />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Celeste" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("wires description as the button's accessible description, in addition to title as its name", () => {
    renderWithProviders(
      <MediaCardShell title="Celeste" coverImageUrl={null} onClick={() => {}} description="2018">
        <span>card body</span>
      </MediaCardShell>,
    );

    const button = screen.getByRole("button", { name: "Celeste" });
    expect(button).toHaveAccessibleDescription("2018");
    expect(screen.getByText("card body")).toBeInTheDocument();
  });

  it("has no accessible description when none is given", () => {
    renderWithProviders(<MediaCardShell title="Celeste" coverImageUrl={null} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Celeste" })).toHaveAccessibleDescription("");
  });
});
