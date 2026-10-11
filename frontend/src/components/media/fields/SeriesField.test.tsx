import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { duneSaga } from "../../../test/fixtures/books";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import type { SeriesDraft } from "../../../domain/media/seriesDraft";
import type { NamedEntry } from "../../../domain/media/vocabularyDraft";
import { apiFetch } from "../../../api/client";
import { SeriesField } from "./SeriesField";

const searchSeries = (term: string, signal: AbortSignal) =>
  apiFetch<NamedEntry[]>(`/api/book-series?search=${encodeURIComponent(term)}`, { signal });

function Harness({ initial = [], onDraft }: { initial?: SeriesDraft[]; onDraft?: (value: SeriesDraft[]) => void }) {
  const [value, setValue] = useState<SeriesDraft[]>(initial);
  return (
    <SeriesField
      value={value}
      fetchSuggestions={searchSeries}
      onChange={(next) => {
        setValue(next);
        onDraft?.(next);
      }}
    />
  );
}

describe("SeriesField", () => {
  it("adds a pending chip with an empty position row and lets the user enter a position", async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    mockApi({ "GET /api/book-series": () => jsonResponse([]) });
    renderWithProviders(<Harness onDraft={onDraft} />);

    await user.click(screen.getByRole("combobox", { name: /series/i }));
    await user.paste("Mistborn");
    await user.keyboard("{Enter}");
    expect(onDraft).toHaveBeenLastCalledWith([{ entry: { name: "Mistborn" }, position: "" }]);

    await user.click(screen.getByRole("textbox", { name: "No. Mistborn" }));
    await user.paste("2,5");
    expect(onDraft).toHaveBeenLastCalledWith([{ entry: { name: "Mistborn" }, position: "2,5" }]);
  });

  it("does not flag a half-typed position until the field is left", async () => {
    const user = userEvent.setup();
    mockApi({});
    renderWithProviders(<Harness initial={[{ entry: duneSaga, position: "" }]} />);

    const input = screen.getByRole("textbox", { name: "No. Dune Saga" });
    await user.click(input);
    await user.paste("2,");
    expect(input).toBeValid();
    await user.paste("5");
    await user.tab();
    expect(input).toBeValid();
  });

  it("keeps the position when a pending chip is upgraded to the existing entry of the same name", async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    mockApi({ "GET /api/book-series": () => jsonResponse([duneSaga]) });
    renderWithProviders(<Harness initial={[{ entry: { name: "dune saga" }, position: "3" }]} onDraft={onDraft} />);

    await user.click(screen.getByRole("combobox", { name: /series/i }));
    await user.paste("dune");
    await user.click(await screen.findByRole("option", { name: duneSaga.name }));

    expect(onDraft).toHaveBeenLastCalledWith([{ entry: duneSaga, position: "3" }]);
  });

  it("shows an error for an invalid position and drops the row when the chip is removed", async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    mockApi({});
    renderWithProviders(<Harness initial={[{ entry: duneSaga, position: "abc" }]} onDraft={onDraft} />);

    const input = screen.getByRole("textbox", { name: "No. Dune Saga" });
    expect(screen.queryByText(/Must be a number from 0 to 9999.99/)).not.toBeInTheDocument();

    await user.click(input);
    await user.tab();
    expect(screen.getByText(/Must be a number from 0 to 9999.99/)).toBeInTheDocument();
    expect(input).toBeInvalid();

    await user.click(screen.getByTestId("CancelIcon"));
    expect(onDraft).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole("textbox", { name: "No. Dune Saga" })).not.toBeInTheDocument();
  });
});
