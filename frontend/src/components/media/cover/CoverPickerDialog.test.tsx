import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CoverOptionsLike, CoverPageRequest } from "../../../hooks/useCoverOptions";
import { renderWithProviders } from "../../../test/renderWithProviders";
import type { CoverOptionResponse } from "../../../types/api";
import { CoverPickerDialog, type CoverPickerDialogProps } from "./CoverPickerDialog";

type Variant = "book" | "audiobook";
type Fetch = (request: CoverPageRequest<string, Variant>) => Promise<CoverOptionsLike<string>>;

const cover = (name: string): CoverOptionResponse => ({
  thumbnailUrl: `https://img/${name}-t.jpg`,
  imageUrl: `https://img/${name}.jpg`,
  width: null,
  height: null,
});

function page(names: string[], pageNumber: number, totalPages: number): CoverOptionsLike<string> {
  return {
    query: "Hobbit",
    matches: [],
    selectedMatchId: null,
    covers: { items: names.map(cover), page: pageNumber, pageSize: names.length, totalItems: 4, totalPages },
  };
}

const withMatches: CoverOptionsLike<string> = {
  query: "Hobbit",
  matches: [
    { id: "OL1W", name: "The Hobbit", releaseYear: 1937 },
    { id: "OL2W", name: "Hobbit Tales", releaseYear: null },
  ],
  selectedMatchId: "OL1W",
  covers: { items: [cover("m")], page: 1, pageSize: 1, totalItems: 1, totalPages: 1 },
};

function renderPicker(fetchPage: Fetch, overrides: Partial<CoverPickerDialogProps<string, Variant>> = {}) {
  return renderWithProviders(
    <CoverPickerDialog<string, Variant>
      open
      onClose={() => {}}
      initialQuery="Hobbit"
      releaseYear={null}
      currentCoverUrl={null}
      onPick={() => {}}
      variant="book"
      fetchPage={fetchPage}
      unavailableCode="unavailable"
      texts={{
        match: "Matching work",
        noMatches: (term) => `Nothing for "${term}"`,
        noCovers: "No covers here.",
        unavailable: "Source is down.",
        attribution: "Covers from Test",
      }}
      {...overrides}
    />,
  );
}

describe("CoverPickerDialog (shared)", () => {
  it("renders nothing while closed", () => {
    renderPicker(vi.fn<Fetch>(), { open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows no match select, no toggle and loads more without a match for a flat source", async () => {
    const user = userEvent.setup();
    const fetchPage = vi.fn<Fetch>((request) =>
      Promise.resolve(request.page === undefined ? page(["a", "b"], 1, 2) : page(["c", "d"], 2, 2)),
    );
    renderPicker(fetchPage);

    await screen.findByRole("button", { name: "Use cover 1" });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /type/i })).not.toBeInTheDocument();
    expect(screen.getByText("Covers from Test")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(screen.getAllByRole("button", { name: /Use cover/ })).toHaveLength(4));
    expect(fetchPage).toHaveBeenLastCalledWith({
      query: "Hobbit",
      releaseYear: null,
      match: undefined,
      variant: "book",
      page: 2,
    });
  });

  it("shows the no-matches text when there are neither matches nor covers", async () => {
    renderPicker(vi.fn<Fetch>().mockResolvedValue(page([], 1, 0)));

    expect(await screen.findByText('Nothing for "Hobbit"')).toBeInTheDocument();
    expect(screen.queryByText("No covers here.")).not.toBeInTheDocument();
  });

  it("shows the unavailable text and hides the variant toggle on a 503 with the given code", async () => {
    const { ApiError } = await import("../../../api/client");
    renderPicker(vi.fn<Fetch>().mockRejectedValue(new ApiError(503, "x", { error: "unavailable" })), {
      variants: {
        options: [{ value: "book", label: "Book" }],
        onChange: () => {},
        ariaLabel: "Source",
      },
    });

    expect(await screen.findByText("Source is down.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Book" })).not.toBeInTheDocument();
  });

  it("selects a string-id match and requests covers for it", async () => {
    const user = userEvent.setup();
    const fetchPage = vi.fn<Fetch>().mockResolvedValue(withMatches);
    renderPicker(fetchPage);

    await user.click(await screen.findByRole("combobox", { name: "Matching work" }));
    await user.click(await screen.findByRole("option", { name: "Hobbit Tales" }));

    await waitFor(() =>
      expect(fetchPage).toHaveBeenLastCalledWith({
        query: "Hobbit",
        releaseYear: null,
        match: "OL2W",
        variant: "book",
      }),
    );
  });

  it("renders the variants toggle and reports a change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker(vi.fn<Fetch>().mockResolvedValue(withMatches), {
      variants: {
        options: [
          { value: "book", label: "Book" },
          { value: "audiobook", label: "Audiobook" },
        ],
        onChange,
        ariaLabel: "Source",
      },
    });

    await user.click(await screen.findByRole("button", { name: "Audiobook" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("audiobook");
    expect(screen.getByRole("button", { name: "Book" })).toHaveAttribute("aria-pressed", "true");
  });
});
