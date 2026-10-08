import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { FilterSelect } from "./FilterSelect";

describe("FilterSelect", () => {
  it("names the select by a visible legend instead of an InputLabel in legend mode", () => {
    const { container } = renderWithProviders(
      <FilterSelect
        label="Platform"
        options={["a"]}
        selected={[]}
        onChange={() => {}}
        getOptionLabel={(option) => option}
        variant="standard"
        labelStyle="legend"
      />,
    );

    expect(screen.getByText("Platform")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Platform" })).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- an InputLabel is only visible as a MUI class
    expect(container.querySelector(".MuiInputLabel-root")).toBeNull();
  });

  it("shows the all placeholder while nothing is selected and the labels once something is", () => {
    const { rerender } = renderWithProviders(
      <FilterSelect label="Platform" options={["a", "b"]} selected={[]} onChange={() => {}} getOptionLabel={String} />,
    );
    expect(screen.getByRole("combobox", { name: "Platform" })).toHaveTextContent("-all-");

    rerender(
      <FilterSelect
        label="Platform"
        options={["a", "b"]}
        selected={["b"]}
        onChange={() => {}}
        getOptionLabel={String}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Platform" })).toHaveTextContent("b");
    expect(screen.getByRole("button", { name: "Clear Platform" })).toBeInTheDocument();
  });
});
