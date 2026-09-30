import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/renderWithProviders";
import { RatingField } from "./RatingField";

// Stars are clicked with `fireEvent.click` on the quarter-star radio and a non-zero clientX/Y: `user.click` hovers
// first, which yields NaN in jsdom's zero-sized boxes, and without coordinates MUI treats the click as a keyboard event.
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

  it("renders read-only with the legend and value, without needing onChange", () => {
    renderWithProviders(<RatingField value={3.25} readOnly />);
    expect(screen.getByText("Rating")).toBeInTheDocument();
    expect(screen.getByText("3.25")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Rating" })).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("emits the clicked value", () => {
    const onChange = vi.fn();
    renderWithProviders(<RatingField value={2} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "4 Stars" }), { clientX: 1, clientY: 1 });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(4);
  });

  it("emits null when the checked value is clicked again", () => {
    const onChange = vi.fn();
    renderWithProviders(<RatingField value={4} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "4 Stars" }), { clientX: 1, clientY: 1 });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("emits nothing when disabled", async () => {
    const onChange = vi.fn();
    renderWithProviders(<RatingField value={2} onChange={onChange} disabled />);
    expect(screen.getByRole("radio", { name: "4 Stars" })).toBeDisabled();
    // fireEvent would dispatch on a disabled input, which a browser never does; user-event respects `disabled`.
    await userEvent.setup({ pointerEventsCheck: 0 }).click(screen.getByRole("radio", { name: "4 Stars" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("when busy stays enabled, is marked aria-busy and emits nothing", () => {
    const onChange = vi.fn();
    renderWithProviders(<RatingField value={2} onChange={onChange} busy />);
    expect(screen.getByRole("group", { name: "Rating" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("radio", { name: "4 Stars" })).toBeEnabled();
    fireEvent.click(screen.getByRole("radio", { name: "4 Stars" }), { clientX: 1, clientY: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names the group once, by its visible legend", () => {
    renderWithProviders(<RatingField value={2} onChange={() => {}} />);
    expect(screen.getAllByText("Rating")).toHaveLength(1);
    expect(screen.getByRole("group", { name: "Rating" })).not.toHaveAttribute("aria-label");
  });

  // MUI derives the hovered value from pointer geometry, which is all zeros in jsdom (NaN). Mocking the bounding box
  // (100px wide at 0) makes `clientX` map to a value: 79 -> 4 stars. Focus does not emit `onChangeActive`, so keyboard
  // navigation never touches the preview.
  describe("hover preview", () => {
    beforeEach(() => {
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
        left: 0,
        right: 100,
        width: 100,
      } as DOMRect);
    });
    // Events on a radio bubble to the Rating root, which owns the mouse handlers.
    const hoverTarget = () => screen.getByRole("radio", { name: "1 Star" });
    const hoverFourStars = (node: HTMLElement) => fireEvent.mouseMove(node, { clientX: 79, clientY: 1 });

    it("shows the hovered value and restores 'not rated yet' on leave", () => {
      renderWithProviders(<RatingField value={null} onChange={() => {}} />);
      const node = hoverTarget();
      hoverFourStars(node);
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.queryByText("Not rated yet")).not.toBeInTheDocument();
      fireEvent.mouseLeave(node);
      expect(screen.getByText("Not rated yet")).toBeInTheDocument();
    });

    it("restores the rated value after leaving", () => {
      renderWithProviders(<RatingField value={2.5} onChange={() => {}} />);
      const node = hoverTarget();
      hoverFourStars(node);
      expect(screen.getByText("4")).toBeInTheDocument();
      fireEvent.mouseLeave(node);
      expect(screen.getByText("2.5")).toBeInTheDocument();
    });

    it("does not change while busy", () => {
      renderWithProviders(<RatingField value={2} onChange={() => {}} busy />);
      hoverFourStars(hoverTarget());
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.queryByText("4")).not.toBeInTheDocument();
    });

    it("shows the actual value while busy and the preview again after, while the pointer still hovers", () => {
      const { rerender } = renderWithProviders(<RatingField value={2} onChange={() => {}} />);
      hoverFourStars(hoverTarget());
      expect(screen.getByText("4")).toBeInTheDocument();
      rerender(<RatingField value={2} onChange={() => {}} busy />);
      expect(screen.getByText("2")).toBeInTheDocument();
      rerender(<RatingField value={2} onChange={() => {}} />);
      expect(screen.getByText("4")).toBeInTheDocument();
    });

    it("shows 'not rated yet' after clearing by clicking the current value", () => {
      function Controlled() {
        const [value, setValue] = useState<number | null>(4);
        return <RatingField value={value} onChange={setValue} />;
      }
      renderWithProviders(<Controlled />);
      const star = screen.getByRole("radio", { name: "4 Stars" });
      hoverFourStars(star);
      fireEvent.click(star, { clientX: 79, clientY: 1 });
      expect(screen.getByText("Not rated yet")).toBeInTheDocument();
    });

    it("does not change when disabled", () => {
      renderWithProviders(<RatingField value={2} onChange={() => {}} disabled />);
      hoverFourStars(hoverTarget());
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.queryByText("4")).not.toBeInTheDocument();
    });

    it("does not change when read-only", () => {
      renderWithProviders(<RatingField value={3.25} readOnly />);
      hoverFourStars(screen.getByRole("img"));
      expect(screen.getByText("3.25")).toBeInTheDocument();
      expect(screen.queryByText("4")).not.toBeInTheDocument();
    });
  });
});
