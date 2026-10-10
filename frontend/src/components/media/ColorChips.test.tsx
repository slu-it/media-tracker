import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ColorChips } from "./ColorChips";

const items = [
  { id: "1", label: "PC", associatedColor: "3366cc" },
  { id: "2", label: "Switch", associatedColor: "cc3333" },
];

/** The chip row is the label's grandparent (label -> Chip root -> row); it has no role. */
// eslint-disable-next-line testing-library/no-node-access -- the row has no role
const rowOf = (label: string) => screen.getByText(label).parentElement!.parentElement!;

describe("ColorChips", () => {
  it("is left-aligned by default", () => {
    renderWithProviders(<ColorChips items={items} />, { realStyles: true });
    expect(rowOf("PC")).not.toHaveStyle({ justifyContent: "center" });
  });

  it("centers wrapped rows when centered", () => {
    renderWithProviders(<ColorChips items={items} centered />, { realStyles: true });
    expect(rowOf("PC")).toHaveStyle({ justifyContent: "center" });
  });
});
