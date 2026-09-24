import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GamePlatformResponse } from "../../../types/api";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { hadesCoverOptions, pc, playstation } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { AddGameDialog } from "./AddGameDialog";

const platforms: GamePlatformResponse[] = [pc, playstation];

/** Typing a 5+ character title (below fires no request) triggers a debounced suggestion request; kept empty here. */
const noTitleSuggestions = { "GET /api/games/title-suggestions": () => jsonResponse({ suggestions: [] }) };

describe("AddGameDialog", () => {
  it("posts the filled form and reports the created game", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const calls = mockApi({
      "POST /api/games": (call) => jsonResponse({ id: "new-id", ...(call.body as object) }, 201),
      ...noTitleSuggestions,
    });
    renderWithProviders(<AddGameDialog open onClose={() => {}} onCreated={onCreated} platforms={platforms} />);
    const dialog = screen.getByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    // user.paste avoids per-keystroke user.type, which is ~10x slower and hit the CI timeout.
    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.click(title);
    await user.paste("Hades");
    await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "2020" }));
    await user.click(within(dialog).getByRole("combobox", { name: /platforms/i }));
    await user.click(screen.getByRole("option", { name: "PC" }));
    expect(save).toBeEnabled(); // description, rating and cover are optional

    const description = within(dialog).getByRole("textbox", { name: /description/i });
    await user.click(description);
    await user.paste("Roguelike dungeon crawler.");
    const coverImageUrl = within(dialog).getByRole("textbox", { name: /cover image url/i });
    await user.click(coverImageUrl);
    await user.paste("https://img.example/h.png");
    expect(within(dialog).getByRole("img", { name: "Cover preview" })).toHaveAttribute(
      "src",
      "https://img.example/h.png",
    );

    await user.click(save);
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    // A debounced title-suggestions request may also have fired by now; only the actual save matters here.
    expect(calls.filter((c) => c.method === "POST")).toEqual([
      {
        method: "POST",
        url: "/api/games",
        body: {
          title: "Hades",
          releaseYear: 2020,
          platformIds: ["platform-pc"],
          description: "Roguelike dungeon crawler.",
          rating: null,
          coverImageUrl: "https://img.example/h.png",
          ownership: "watchlist",
          progress: "not_started",
          hidden: false,
        },
      },
    ]);
    expect(onCreated.mock.calls[0][0]).toMatchObject({ id: "new-id", title: "Hades" });
  });

  it("posts the chosen ownership, progress and hidden state", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const calls = mockApi({
      "POST /api/games": (call) => jsonResponse({ id: "new-id", ...(call.body as object) }, 201),
      ...noTitleSuggestions,
    });
    renderWithProviders(<AddGameDialog open onClose={() => {}} onCreated={onCreated} platforms={platforms} />);
    const dialog = screen.getByRole("dialog");

    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.click(title);
    await user.paste("Hades");
    await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "2020" }));
    await user.click(within(dialog).getByRole("combobox", { name: /platforms/i }));
    await user.click(screen.getByRole("option", { name: "PC" }));

    await user.click(within(dialog).getByRole("combobox", { name: "Ownership" }));
    await user.click(screen.getByRole("option", { name: "Owned" }));
    await user.click(within(dialog).getByRole("combobox", { name: "Progress" }));
    await user.click(screen.getByRole("option", { name: "Playing" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Hidden" }));

    const save = within(dialog).getByRole("button", { name: "Save" });
    await user.click(save);
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    // A debounced title-suggestions GET (mocked via `noTitleSuggestions`) may also be in `calls` by now; filter
    // to the POST that actually created the game.
    expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({
      ownership: "owned",
      progress: "playing",
      hidden: true,
    });
  });

  it("has no delete action and resets when reopened", async () => {
    mockApi(noTitleSuggestions);
    const { rerender } = renderWithProviders(
      <AddGameDialog open onClose={() => {}} onCreated={() => {}} platforms={platforms} />,
    );
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    const user = userEvent.setup();
    const title = screen.getByRole("combobox", { name: /title/i });
    await user.click(title);
    await user.paste("Draft");

    rerender(<AddGameDialog open={false} onClose={() => {}} onCreated={() => {}} platforms={platforms} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    rerender(<AddGameDialog open onClose={() => {}} onCreated={() => {}} platforms={platforms} />);
    expect(screen.getByRole("combobox", { name: /title/i })).toHaveValue("");
  });

  it("shows the backend error and stays open when creating fails", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    mockApi({
      "POST /api/games": () => jsonResponse({ error: "validation_error", message: "title: nope" }, 400),
      ...noTitleSuggestions,
    });
    renderWithProviders(<AddGameDialog open onClose={() => {}} onCreated={onCreated} platforms={platforms} />);
    const dialog = screen.getByRole("dialog");

    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.click(title);
    await user.paste("Hades");
    await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "2020" }));
    await user.click(within(dialog).getByRole("combobox", { name: /platforms/i }));
    await user.click(screen.getByRole("option", { name: "PC" }));

    const save = within(dialog).getByRole("button", { name: "Save" });
    await user.click(save);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("title: nope");
    expect(onCreated).not.toHaveBeenCalled();
    expect(save).toBeEnabled();
  });

  it("while saving the cover preview is not a button", async () => {
    const user = userEvent.setup();
    mockApi({
      "POST /api/games": () => new Promise<Response>(() => {}),
      ...noTitleSuggestions,
    });
    renderWithProviders(<AddGameDialog open onClose={() => {}} onCreated={() => {}} platforms={platforms} />);
    const dialog = screen.getByRole("dialog");

    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.click(title);
    await user.paste("Hades");
    await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "2020" }));
    await user.click(within(dialog).getByRole("combobox", { name: /platforms/i }));
    await user.click(screen.getByRole("option", { name: "PC" }));

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(screen.queryByRole("button", { name: "Choose a cover image" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: "No cover image" })).toBeInTheDocument();
  });

  it("the cover preview opens the picker and a pick fills the url field", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions),
      ...noTitleSuggestions,
    });
    renderWithProviders(<AddGameDialog open onClose={() => {}} onCreated={() => {}} platforms={platforms} />);
    const dialog = screen.getByRole("dialog");

    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.click(title);
    await user.paste("Hades");

    await user.click(within(dialog).getByRole("button", { name: "Choose a cover image" }));
    await screen.findByText("Choose a cover");
    await waitFor(() => expect(calls.some((c) => c.url === "/api/games/cover-options?query=Hades")).toBe(true));

    await user.click(await screen.findByRole("button", { name: "Use cover 1" }));

    const coverImageUrl = within(dialog).getByRole("textbox", { name: /cover image url/i });
    expect(coverImageUrl).toHaveValue(hadesCoverOptions.covers.items[0].imageUrl);
    expect(within(dialog).getByRole("img", { name: "Cover preview" })).toHaveAttribute(
      "src",
      hadesCoverOptions.covers.items[0].imageUrl,
    );
  });

  it("with an empty title the picker shows the hint and requests nothing", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions),
    });
    renderWithProviders(<AddGameDialog open onClose={() => {}} onCreated={() => {}} platforms={platforms} />);
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Choose a cover image" }));

    expect(await screen.findByText("Enter a search term to look for covers.")).toBeInTheDocument();
    await flushAsync();
    expect(calls).toHaveLength(0);
  });
});
