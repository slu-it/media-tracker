import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { hadesExpansion1, hadesExpansion2, hadesExpansions } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { ExpansionList } from "./ExpansionList";

describe("ExpansionList", () => {
  it("renders nothing for an empty list", () => {
    const { container } = renderWithProviders(<ExpansionList expansions={[]} onSelect={() => {}} onMove={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Expansions")).not.toBeInTheDocument();
  });

  it("renders one card per expansion in order", () => {
    renderWithProviders(<ExpansionList expansions={hadesExpansions} onSelect={() => {}} onMove={() => {}} />);

    expect(screen.getByText("Expansions")).toBeInTheDocument();
    const first = screen.getByText(hadesExpansion1.title);
    const second = screen.getByText(hadesExpansion2.title);
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("calls onSelect with the clicked expansion", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(<ExpansionList expansions={hadesExpansions} onSelect={onSelect} onMove={() => {}} />);

    await user.click(screen.getByRole("button", { name: hadesExpansion2.title }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(hadesExpansion2);
  });

  it("moves the second card to the top via the keyboard sensor on its drag handle", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    renderWithProviders(<ExpansionList expansions={hadesExpansions} onSelect={() => {}} onMove={onMove} />);

    // Raw .focus() fires a native focus event outside of React's act-wrapped event dispatch (MUI's ButtonBase
    // sets its internal focusVisible state from it), so it must itself be wrapped.
    const handle = screen.getByRole("button", { name: `Reorder ${hadesExpansion2.title}` });
    act(() => handle.focus());
    await user.keyboard("[Space]"); // pick up
    await user.keyboard("[ArrowUp]"); // move over the first card
    await user.keyboard("[Space]"); // drop

    expect(onMove).toHaveBeenCalledExactlyOnceWith(hadesExpansion2.id, 0);
  });
});
