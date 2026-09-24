import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import {
  celeste,
  emptyCoverOptions,
  hades,
  hadesAnimatedCoverOptions,
  hadesCoverOptions,
  hadesCoverOptionsPage2,
} from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { CoverPickerDialog } from "./CoverPickerDialog";

describe("CoverPickerDialog", () => {
  it("requests cover options for the initial query on open", async () => {
    const calls = mockApi({ "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions) });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ method: "GET", url: "/api/games/cover-options?query=Hades" });
  });

  it("truncates a title longer than the search maximum before requesting cover options", async () => {
    const longTitle = "A".repeat(250);
    const calls = mockApi({ "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions) });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={longTitle}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({
      method: "GET",
      url: `/api/games/cover-options?query=${"A".repeat(200)}`,
    });
  });

  it("renders one thumbnail button per cover with the thumbnail as its image", async () => {
    mockApi({ "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions) });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );

    const first = await screen.findByRole("button", { name: "Use cover 1" });
    const second = screen.getByRole("button", { name: "Use cover 2" });
    // The thumbnails are decorative (empty alt), so their implicit role is "presentation", not "img".
    expect(within(first).getByRole("presentation")).toHaveAttribute(
      "src",
      hadesCoverOptions.covers.items[0].thumbnailUrl,
    );
    expect(within(second).getByRole("presentation")).toHaveAttribute(
      "src",
      hadesCoverOptions.covers.items[1].thumbnailUrl,
    );
  });

  it("marks the current cover as pressed among the thumbnails", async () => {
    mockApi({ "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions) });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={celeste.title}
        releaseYear={null}
        currentCoverUrl={hadesCoverOptions.covers.items[1].imageUrl}
        onPick={() => {}}
      />,
    );

    const first = await screen.findByRole("button", { name: "Use cover 1" });
    const second = screen.getByRole("button", { name: "Use cover 2" });
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onPick with the picked cover's full-size URL and leaves the dialog open", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn().mockResolvedValue(undefined);
    mockApi({ "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions) });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={onPick}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Use cover 1" }));

    await waitFor(() => expect(onPick).toHaveBeenCalledExactlyOnceWith(hadesCoverOptions.covers.items[0].imageUrl));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the pick error when onPick rejects", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn().mockRejectedValue(new Error("nope"));
    mockApi({ "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions) });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={onPick}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Use cover 1" }));

    expect(await screen.findByText("Saving failed.")).toBeInTheDocument();
  });

  it("shows a hint instead of covers while the search term is blank", async () => {
    const calls = mockApi({ "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions) });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery=""
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );

    expect(await screen.findByText("Enter a search term to look for covers.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Use cover/ })).not.toBeInTheDocument();
    await flushAsync();
    expect(calls).toHaveLength(0);
  });

  it("shows the not-configured message on a 503", async () => {
    mockApi({
      "GET /api/games/cover-options": () => jsonResponse({ error: "cover_source_unavailable" }, 503),
    });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );

    expect(
      await screen.findByText("Cover search is not configured on this server (STEAMGRIDDB_API_KEY)."),
    ).toBeInTheDocument();
  });

  it("shows a load-failure message with a retry button that re-requests", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/cover-options": () => jsonResponse({ error: "internal_error" }, 500),
    });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );

    expect(await screen.findByText("Could not load cover suggestions.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(calls).toHaveLength(2));
  });

  it("shows the no-matches message when nothing matched the search", async () => {
    mockApi({ "GET /api/games/cover-options": () => jsonResponse(emptyCoverOptions) });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );

    expect(await screen.findByText('No games found for "Nonexistent Game"')).toBeInTheDocument();
  });

  it("requests covers for the newly selected match", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/cover-options": (_call, url) =>
        jsonResponse(
          url.searchParams.has("match")
            ? { ...hadesCoverOptions, covers: { ...hadesCoverOptions.covers, items: [], totalItems: 0, totalPages: 0 } }
            : hadesCoverOptions,
        ),
    });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );

    await user.click(await screen.findByRole("combobox", { name: "Matching game" }));
    await user.click(await screen.findByRole("option", { name: "Hades II (2024)" }));

    await waitFor(() =>
      expect(calls.some((c) => c.url === "/api/games/cover-options?query=Hades&match=9999")).toBe(true),
    );
  });

  it("requests animated covers via the type toggle and renders the animated thumbnail", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/cover-options": (_call, url) =>
        jsonResponse(url.searchParams.get("type") === "animated" ? hadesAnimatedCoverOptions : hadesCoverOptions),
    });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );
    await waitFor(() => expect(calls).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Animated" }));

    await waitFor(() =>
      expect(calls.some((c) => c.url === "/api/games/cover-options?query=Hades&type=animated")).toBe(true),
    );
    const cover = await screen.findByRole("button", { name: "Use cover 1" });
    // SteamGridDB serves animated grids' thumbnails as WebM clips, which render as an `aria-hidden` <video>
    // (the button carries the label), so it needs `hidden: true` to be found.
    expect(within(cover).getByRole("presentation", { hidden: true })).toHaveAttribute(
      "src",
      hadesAnimatedCoverOptions.covers.items[0].thumbnailUrl,
    );
  });

  it("shows how many of the total covers are shown", async () => {
    mockApi({ "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions) });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );

    expect(await screen.findByText("2 of 120 covers")).toBeInTheDocument();
  });

  it("loads and appends the next page on Load more", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/cover-options": (_call, url) =>
        jsonResponse(url.searchParams.has("page") ? hadesCoverOptionsPage2 : hadesCoverOptions),
    });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );
    await screen.findByRole("button", { name: "Use cover 1" });

    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() =>
      expect(calls.some((c) => c.url === "/api/games/cover-options?query=Hades&match=5245&page=2")).toBe(true),
    );
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Use cover/ })).toHaveLength(4));
    expect(screen.getByText("4 of 120 covers")).toBeInTheDocument();
  });

  it("shows no Load more button once every page has been loaded", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games/cover-options": (_call, url) =>
        jsonResponse(url.searchParams.get("type") === "animated" ? hadesAnimatedCoverOptions : hadesCoverOptions),
    });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );
    await screen.findByRole("button", { name: "Use cover 1" });

    await user.click(screen.getByRole("button", { name: "Animated" }));

    await screen.findByText("1 of 1 cover");
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("keeps the first page's thumbnails and shows the load-failed message when Load more fails", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games/cover-options": (_call, url) =>
        url.searchParams.has("page") ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(hadesCoverOptions),
    });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );
    await screen.findByRole("button", { name: "Use cover 1" });

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Could not load cover suggestions.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use cover 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use cover 2" })).toBeInTheDocument();
    // The "Load more" button is the retry for this failure; a separate Retry action would duplicate it.
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("requests covers for a new search term after the debounce", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/cover-options": (_call, url) =>
        jsonResponse(url.searchParams.get("query") === "Portal" ? emptyCoverOptions : hadesCoverOptions),
    });
    renderWithProviders(
      <CoverPickerDialog
        open
        onClose={() => {}}
        initialQuery={hades.title}
        releaseYear={null}
        currentCoverUrl={null}
        onPick={() => {}}
      />,
    );
    await waitFor(() => expect(calls).toHaveLength(1));

    const search = screen.getByRole("textbox", { name: "Search term" });
    await user.clear(search);
    await user.paste("Portal");

    await waitFor(() => expect(calls.some((c) => c.url === "/api/games/cover-options?query=Portal")).toBe(true));
  });
});
