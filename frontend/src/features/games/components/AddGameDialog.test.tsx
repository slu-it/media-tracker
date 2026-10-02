import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GameDeveloperResponse, GamePlatformResponse } from "../../../types/api";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { developers, hadesCoverOptions, pc, playstation, teamCherry } from "../../../test/fixtures/games";
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
    const dialog = screen.getByRole("dialog", { name: "Add game" });
    expect(within(dialog).queryByRole("heading", { name: "Add game" })).not.toBeInTheDocument();
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
          platformIds: [pc.id],
          description: "Roguelike dungeon crawler.",
          rating: null,
          coverImageUrl: "https://img.example/h.png",
          ownership: "watchlist",
          progress: "not_started",
          hidden: false,
          releaseDate: null,
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

    const ownedSwitch = within(dialog).getByRole("switch", { name: "Owned" });
    expect(ownedSwitch).not.toBeChecked();
    await user.click(ownedSwitch);
    expect(ownedSwitch).toBeChecked();
    await user.click(
      within(within(dialog).getByRole("group", { name: "Progress" })).getByRole("button", { name: "Playing" }),
    );
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

  it("creates a pending developer before creating the game, and sends both ids", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const createdDeveloper: GameDeveloperResponse = { id: "developer-new", name: "New Studio" };
    const calls = mockApi({
      "POST /api/games": (call) => jsonResponse({ id: "new-id", ...(call.body as object) }, 201),
      "POST /api/game-developers": () => jsonResponse(createdDeveloper, 201),
      "GET /api/game-developers": () => jsonResponse(developers),
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

    const developersField = within(dialog).getByRole("combobox", { name: /developers/i });
    await user.click(developersField);
    await user.paste("New Studio");
    await user.keyboard("{Enter}");

    await user.click(developersField);
    await user.paste("team cherry");
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
    await user.keyboard("{Enter}");

    const save = within(dialog).getByRole("button", { name: "Save" });
    await user.click(save);
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());

    const developerPost = calls.find((c) => c.url === "/api/game-developers" && c.method === "POST");
    const gamePost = calls.find((c) => c.url === "/api/games" && c.method === "POST");
    expect(developerPost).toBeDefined();
    expect(gamePost).toBeDefined();
    expect(calls.indexOf(developerPost!)).toBeLessThan(calls.indexOf(gamePost!));
    expect(developerPost!.body).toEqual({ name: "New Studio" });
    expect(gamePost!.body).toMatchObject({ developerIds: [createdDeveloper.id, teamCherry.id] });
  });

  it("shows the error and does not create the game when creating a developer fails", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const calls = mockApi({
      "POST /api/games": (call) => jsonResponse({ id: "new-id", ...(call.body as object) }, 201),
      "POST /api/game-developers": () => jsonResponse({ error: "internal_error" }, 500),
      "GET /api/game-developers": () => jsonResponse([]),
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

    const developersField = within(dialog).getByRole("combobox", { name: /developers/i });
    await user.click(developersField);
    await user.paste("New Studio");
    await user.keyboard("{Enter}");

    const save = within(dialog).getByRole("button", { name: "Save" });
    await user.click(save);

    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(calls.some((c) => c.url === "/api/games" && c.method === "POST")).toBe(false);
    expect(save).toBeEnabled();
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

  it("disables save while a picked release date is invalid, and re-enables it once cleared", async () => {
    const user = userEvent.setup();
    mockApi(noTitleSuggestions);
    renderWithProviders(<AddGameDialog open onClose={() => {}} onCreated={() => {}} platforms={platforms} />);
    const dialog = screen.getByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save" });

    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.click(title);
    await user.paste("Hades");
    await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "2020" }));
    await user.click(within(dialog).getByRole("combobox", { name: /platforms/i }));
    await user.click(screen.getByRole("option", { name: "PC" }));
    expect(save).toBeEnabled();

    // ArrowUp fills an empty section with a default (today's year/month/day), giving a full valid date without
    // typing a fresh multi-digit section, which is flaky to drive through jsdom (see ReleaseDateField.test.tsx).
    const releaseDate = within(dialog).getByRole("group", { name: "Release date" });
    await user.click(within(releaseDate).getByRole("spinbutton", { name: "Year" }));
    await user.keyboard("{ArrowUp}{ArrowRight}{ArrowUp}{ArrowRight}{ArrowUp}");
    expect(save).toBeEnabled();

    await user.click(within(releaseDate).getByRole("spinbutton", { name: "Year" }));
    await user.keyboard("0");
    expect(save).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(save).toBeEnabled();
  });

  it("shows the default progress pressed in the toggle bar on add", () => {
    mockApi(noTitleSuggestions);
    renderWithProviders(<AddGameDialog open onClose={() => {}} onCreated={() => {}} platforms={platforms} />);
    const dialog = screen.getByRole("dialog");
    const group = within(dialog).getByRole("group", { name: "Progress" });

    expect(within(dialog).getAllByRole("group", { name: "Progress" })).toHaveLength(1);
    expect(within(dialog).getByText("Progress")).toBeInTheDocument();
    expect(within(dialog).getByText("Rating")).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Not started" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "Playing" })).toHaveAttribute("aria-pressed", "false");
  });

  it("lays out the fields in the documented order", async () => {
    mockApi(noTitleSuggestions);
    renderWithProviders(<AddGameDialog open onClose={() => {}} onCreated={() => {}} platforms={platforms} />);
    const dialog = screen.getByRole("dialog");

    const order = [
      within(dialog).getByRole("combobox", { name: /title/i }),
      within(dialog).getByRole("textbox", { name: /description/i }),
      within(dialog).getByRole("combobox", { name: /platforms/i }),
      within(dialog).getByRole("combobox", { name: /release year/i }),
      within(dialog).getByRole("group", { name: "Release date" }),
      within(dialog).getByRole("combobox", { name: /developers/i }),
      within(dialog).getByRole("checkbox", { name: "Hidden" }),
      within(dialog).getByRole("textbox", { name: /cover image url/i }),
    ];
    expect(within(dialog).queryByRole("combobox", { name: "Ownership" })).not.toBeInTheDocument();
    // The cover column stacks rating, ownership switch and progress toggle bar, in that order.
    const rating = within(dialog).getByRole("group", { name: "Rating" });
    const ownership = within(dialog).getByRole("group", { name: "Ownership" });
    const progress = within(dialog).getByRole("group", { name: "Progress" });
    expect(rating.compareDocumentPosition(ownership) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ownership.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (let i = 0; i < order.length - 1; i++) {
      expect(order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
