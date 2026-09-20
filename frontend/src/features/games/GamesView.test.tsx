import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { GamePlatformResponse, GameResponse } from "../../types/api";
import { jsonResponse, mockApi, noContent } from "../../test/mockFetch";
import { celeste, hades, nintendo, pc } from "../../test/fixtures/games";
import { renderWithProviders } from "../../test/renderWithProviders";
import { GamesView } from "./GamesView";

const platforms: GamePlatformResponse[] = [pc, nintendo];
const games: GameResponse[] = [celeste, hades];

function pageOf(items: GameResponse[], page: number, totalItems: number) {
  return { items, page, pageSize: 50, totalItems, totalPages: Math.ceil(totalItems / 50) };
}

function mockPlatforms() {
  return jsonResponse(platforms);
}

/** URLs of `GET /api/games` requests, in order. */
function gamesUrls(calls: { url: string }[]) {
  return calls.map((c) => c.url).filter((url) => url.startsWith("/api/games?"));
}

/**
 * Filters the fixture games by the `search` query param, like the real backend would. Without a search term
 * this only "browses" Celeste, so a later match for another title proves the search request actually happened.
 */
function searchAwareGames(_call: unknown, url: URL) {
  const page = Number(url.searchParams.get("page"));
  const search = (url.searchParams.get("search") ?? "").toLowerCase();
  if (search.length === 0) return jsonResponse(pageOf([celeste], page, 1));
  const matches = games.filter((g) => g.title.toLowerCase().includes(search));
  return jsonResponse(pageOf(matches, page, matches.length));
}

describe("GamesView", () => {
  it("renders the grid, both pagination bars and opens the detail dialog from a card", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)), "GET /api/game-platforms": mockPlatforms });
    renderWithProviders(<GamesView />);

    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(screen.getAllByText("1 – 2 of 2")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Playing" })).toBeInTheDocument(); // Celeste's card status icon
    expect(screen.getByRole("img", { name: "Watchlist" })).toBeInTheDocument(); // Hades' card status icon

    await user.click(screen.getByRole("button", { name: /Hades/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(within(dialog).getByText("PC")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("requests the next page from the pagination control", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const page = Number(url.searchParams.get("page"));
        return jsonResponse(pageOf(page === 1 ? games : [games[1]], page, 51));
      },
      "GET /api/game-platforms": mockPlatforms,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findAllByText("51 – 51 of 51")).toHaveLength(2);
    expect(calls.map((c) => c.url).filter((url) => url.startsWith("/api/games"))).toEqual([
      "/api/games?page=1&pageSize=50",
      "/api/games?page=2&pageSize=50",
    ]);
  });

  it("shows the empty state and opens the add dialog from the FAB", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/games": () => jsonResponse(pageOf([], 1, 0)), "GET /api/game-platforms": mockPlatforms });
    renderWithProviders(<GamesView />);
    expect(await screen.findByText(/No games yet/)).toBeInTheDocument();
    expect(screen.queryByText(/of 0/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add game" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Add game" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("shows an error with a retry button when loading fails", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      "GET /api/games": () =>
        fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
  });

  it("shows an error with a retry button when loading the platforms fails", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": () =>
        fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(platforms),
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    expect(screen.getByRole("button", { name: "Add game" })).toBeDisabled();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Add game" })).toBeEnabled();
  });

  it("shows the previous page after deleting the last game of a later page", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const page = Number(url.searchParams.get("page"));
        return jsonResponse(pageOf(page === 1 ? games : [games[1]], page, 51));
      },
      "GET /api/game-platforms": mockPlatforms,
      "DELETE /api/games/:id": () => noContent(),
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Hades/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Hades"?');
    // Selects the last-mounted (topmost) portal: the confirm dialog stacked over the detail dialog.
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
    expect(calls).toContainEqual({ method: "DELETE", url: "/api/games/id-2", body: undefined });
    const deleteIndex = calls.findIndex((c) => c.method === "DELETE");
    const gamesCallsAfterDelete = calls.slice(deleteIndex + 1).filter((c) => c.url.startsWith("/api/games?"));
    expect(gamesCallsAfterDelete.map((c) => c.url)).toEqual(["/api/games?page=1&pageSize=50"]);
  });

  it("reloads the current page after deleting a game that was not the last one", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "DELETE /api/games/:id": () => noContent(),
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Celeste/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Celeste"?');
    // Selects the last-mounted (topmost) portal: the confirm dialog stacked over the detail dialog.
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith("/api/games?"))).toHaveLength(2));
    const gamesCalls = calls.filter((c) => c.url.startsWith("/api/games?"));
    expect(gamesCalls.map((c) => c.url)).toEqual(["/api/games?page=1&pageSize=50", "/api/games?page=1&pageSize=50"]);
    const deleteIndex = calls.findIndex((c) => c.method === "DELETE");
    expect(deleteIndex).toBeGreaterThan(0);
    expect(calls[deleteIndex + 1]?.url).toBe("/api/games?page=1&pageSize=50");
  });

  it("updates the open game and reloads the list after saving", async () => {
    const user = userEvent.setup();
    let reloaded = false;
    const calls = mockApi({
      "GET /api/games": () => {
        const items = reloaded ? [{ ...games[0], title: "Celeste (Switch)" }, games[1]] : games;
        reloaded = true;
        return jsonResponse(pageOf(items, 1, 2));
      },
      "GET /api/game-platforms": mockPlatforms,
      "PATCH /api/games/:id": (call) => jsonResponse({ ...games[0], ...(call.body as object) }),
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Celeste/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.clear(title);
    await user.paste("Celeste (Switch)");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("heading", { name: "Celeste (Switch)" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith("/api/games?"))).toHaveLength(2));

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Celeste (Switch)" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Celeste" })).not.toBeInTheDocument();
  });

  it("closes the add dialog and reloads the list after creating a game", async () => {
    const user = userEvent.setup();
    let reloaded = false;
    const calls = mockApi({
      "GET /api/games": () => {
        const items = reloaded ? [...games, { ...games[1], id: "id-3", title: "Hollow Knight" }] : games;
        const totalItems = reloaded ? 3 : 2;
        reloaded = true;
        return jsonResponse(pageOf(items, 1, totalItems));
      },
      "GET /api/game-platforms": mockPlatforms,
      "POST /api/games": (call) => jsonResponse({ id: "id-3", ...(call.body as object) }, 201),
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add game" }));
    const dialog = await screen.findByRole("dialog");
    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.click(title);
    await user.paste("Hollow Knight");
    await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "2020" }));
    await user.click(within(dialog).getByRole("combobox", { name: /platforms/i }));
    await user.click(screen.getByRole("option", { name: "PC" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === "POST" && c.url === "/api/games")).toBe(true);
    const gamesCalls = calls.filter((c) => c.url.startsWith("/api/games?"));
    expect(gamesCalls).toHaveLength(2);
  });

  it("sends one request with the search term after the debounce and shows the matches", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "GET /api/games": searchAwareGames, "GET /api/game-platforms": mockPlatforms });
    renderWithProviders(<GamesView searchDebounceMs={300} />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search games" }));
    await user.paste("hades");
    expect(gamesUrls(calls)).toEqual(["/api/games?page=1&pageSize=50"]);

    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(gamesUrls(calls)).toEqual(["/api/games?page=1&pageSize=50", "/api/games?page=1&pageSize=50&search=hades"]);
  });

  it("coalesces edits within the debounce window into a single request", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "GET /api/games": searchAwareGames, "GET /api/game-platforms": mockPlatforms });
    renderWithProviders(<GamesView searchDebounceMs={300} />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search games" });
    await user.click(search);
    await user.paste("ha");
    await user.paste("des");

    await waitFor(() =>
      expect(gamesUrls(calls).filter((url) => url.includes("search="))).toEqual([
        "/api/games?page=1&pageSize=50&search=hades",
      ]),
    );
  });

  it("clears the search with the clear button and drops the search param", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "GET /api/games": searchAwareGames, "GET /api/game-platforms": mockPlatforms });
    renderWithProviders(<GamesView searchDebounceMs={300} />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search games" }));
    await user.paste("hades");
    await screen.findByRole("heading", { name: "Hades" });

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
    expect(gamesUrls(calls).at(-1)).toBe("/api/games?page=1&pageSize=50");
  });

  it("returns to page 1 when the search term changes on a later page", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const page = Number(url.searchParams.get("page"));
        return jsonResponse(pageOf(page === 1 ? games : [games[1]], page, 51));
      },
      "GET /api/game-platforms": mockPlatforms,
    });
    renderWithProviders(<GamesView searchDebounceMs={300} />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search games" }));
    await user.paste("hades");

    await waitFor(() =>
      expect(gamesUrls(calls)).toEqual([
        "/api/games?page=1&pageSize=50",
        "/api/games?page=2&pageSize=50",
        "/api/games?page=1&pageSize=50&search=hades",
      ]),
    );
  });

  it("shows the search-specific empty state when nothing matches", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/games": searchAwareGames, "GET /api/game-platforms": mockPlatforms });
    renderWithProviders(<GamesView searchDebounceMs={300} />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search games" }));
    await user.paste("zzz");

    expect(await screen.findByText('No games match "zzz"')).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search games" })).toHaveValue("zzz");
    expect(screen.queryByText(/of 0/)).not.toBeInTheDocument();
  });

  it("searches immediately on Enter", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "GET /api/games": searchAwareGames, "GET /api/game-platforms": mockPlatforms });
    renderWithProviders(<GamesView searchDebounceMs={5000} />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search games" }));
    await user.paste("hades");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(gamesUrls(calls)).toContain("/api/games?page=1&pageSize=50&search=hades"), {
      timeout: 500,
    });
  });
});
