import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { celeste, emptyCoverOptions, hades, hadesCoverOptions } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { CoverPickerDialog } from "./CoverPickerDialog";

describe("CoverPickerDialog", () => {
  it("requests cover options for the game's title on open", async () => {
    const calls = mockApi({ "GET /api/games/:id/cover-options": () => jsonResponse(hadesCoverOptions) });
    renderWithProviders(<CoverPickerDialog game={hades} open onClose={() => {}} onSaved={() => {}} />);

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ method: "GET", url: `/api/games/${hades.id}/cover-options?query=Hades` });
  });

  it("truncates a title longer than the search maximum before requesting cover options", async () => {
    const longTitle = "A".repeat(250);
    const calls = mockApi({ "GET /api/games/:id/cover-options": () => jsonResponse(hadesCoverOptions) });
    renderWithProviders(
      <CoverPickerDialog game={{ ...hades, title: longTitle }} open onClose={() => {}} onSaved={() => {}} />,
    );

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({
      method: "GET",
      url: `/api/games/${hades.id}/cover-options?query=${"A".repeat(200)}`,
    });
  });

  it("renders one thumbnail button per cover with the thumbnail as its image", async () => {
    mockApi({ "GET /api/games/:id/cover-options": () => jsonResponse(hadesCoverOptions) });
    renderWithProviders(<CoverPickerDialog game={hades} open onClose={() => {}} onSaved={() => {}} />);

    const first = await screen.findByRole("button", { name: "Use cover 1" });
    const second = screen.getByRole("button", { name: "Use cover 2" });
    // The thumbnails are decorative (empty alt), so their implicit role is "presentation", not "img".
    expect(within(first).getByRole("presentation")).toHaveAttribute("src", hadesCoverOptions.covers[0].thumbnailUrl);
    expect(within(second).getByRole("presentation")).toHaveAttribute("src", hadesCoverOptions.covers[1].thumbnailUrl);
  });

  it("marks the game's current cover as pressed among the thumbnails", async () => {
    mockApi({ "GET /api/games/:id/cover-options": () => jsonResponse(hadesCoverOptions) });
    renderWithProviders(
      <CoverPickerDialog
        game={{ ...celeste, coverImageUrl: hadesCoverOptions.covers[1].imageUrl }}
        open
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    const first = await screen.findByRole("button", { name: "Use cover 1" });
    const second = screen.getByRole("button", { name: "Use cover 2" });
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "true");
  });

  it("PATCHes the chosen cover and reports the saved game", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const updated = { ...hades, coverImageUrl: hadesCoverOptions.covers[0].imageUrl };
    const calls = mockApi({
      "GET /api/games/:id/cover-options": () => jsonResponse(hadesCoverOptions),
      "PATCH /api/games/:id": () => jsonResponse(updated),
    });
    renderWithProviders(<CoverPickerDialog game={hades} open onClose={() => {}} onSaved={onSaved} />);

    await user.click(await screen.findByRole("button", { name: "Use cover 1" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledExactlyOnceWith(updated));
    expect(calls.find((c) => c.method === "PATCH")).toMatchObject({
      url: `/api/games/${hades.id}`,
      body: { coverImageUrl: hadesCoverOptions.covers[0].imageUrl },
    });
  });

  it("shows the not-configured message on a 503", async () => {
    mockApi({
      "GET /api/games/:id/cover-options": () => jsonResponse({ error: "cover_source_unavailable" }, 503),
    });
    renderWithProviders(<CoverPickerDialog game={hades} open onClose={() => {}} onSaved={() => {}} />);

    expect(
      await screen.findByText("Cover search is not configured on this server (STEAMGRIDDB_API_KEY)."),
    ).toBeInTheDocument();
  });

  it("shows a load-failure message with a retry button that re-requests", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/:id/cover-options": () => jsonResponse({ error: "internal_error" }, 500),
    });
    renderWithProviders(<CoverPickerDialog game={hades} open onClose={() => {}} onSaved={() => {}} />);

    expect(await screen.findByText("Could not load cover suggestions.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(calls).toHaveLength(2));
  });

  it("shows the no-matches message when nothing matched the search", async () => {
    mockApi({ "GET /api/games/:id/cover-options": () => jsonResponse(emptyCoverOptions) });
    renderWithProviders(<CoverPickerDialog game={hades} open onClose={() => {}} onSaved={() => {}} />);

    expect(await screen.findByText('No games found for "Nonexistent Game"')).toBeInTheDocument();
  });

  it("requests covers for the newly selected match", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/:id/cover-options": (_call, url) =>
        jsonResponse(url.searchParams.has("match") ? { ...hadesCoverOptions, covers: [] } : hadesCoverOptions),
    });
    renderWithProviders(<CoverPickerDialog game={hades} open onClose={() => {}} onSaved={() => {}} />);

    await user.click(await screen.findByRole("combobox", { name: "Matching game" }));
    await user.click(await screen.findByRole("option", { name: "Hades II (2024)" }));

    await waitFor(() =>
      expect(calls.some((c) => c.url === `/api/games/${hades.id}/cover-options?query=Hades&match=9999`)).toBe(true),
    );
  });

  it("requests covers for a new search term after the debounce", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/:id/cover-options": (_call, url) =>
        jsonResponse(url.searchParams.get("query") === "Portal" ? emptyCoverOptions : hadesCoverOptions),
    });
    renderWithProviders(<CoverPickerDialog game={hades} open onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(calls).toHaveLength(1));

    const search = screen.getByRole("textbox", { name: "Search term" });
    await user.clear(search);
    await user.paste("Portal");

    await waitFor(() =>
      expect(calls.some((c) => c.url === `/api/games/${hades.id}/cover-options?query=Portal`)).toBe(true),
    );
  });
});
