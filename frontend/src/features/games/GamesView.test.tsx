import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useNavigate } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { GamePlatformResponse, GameResponse } from "../../types/api";
import { jsonResponse, mockApi, noContent } from "../../test/mockFetch";
import { celeste, hades, meta, nintendo, pc } from "../../test/fixtures/games";
import { currentLocation } from "../../test/currentLocation";
import { flushAsync } from "../../test/flushAsync";
import { HistoryControls } from "../../test/HistoryControls";
import { renderWithProviders } from "../../test/renderWithProviders";
import { GAMES_PAGE_SIZE } from "./domain/gameValues";
import { GamesView } from "./GamesView";

const platforms: GamePlatformResponse[] = [pc, nintendo];
const games: GameResponse[] = [celeste, hades];

function pageOf(items: GameResponse[], page: number, totalItems: number) {
  return {
    items,
    page,
    pageSize: GAMES_PAGE_SIZE,
    totalItems,
    totalPages: Math.ceil(totalItems / GAMES_PAGE_SIZE),
  };
}

function mockPlatforms() {
  return jsonResponse(platforms);
}

function mockMeta() {
  return jsonResponse(meta);
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

/** The results row is visually hidden (absolutely positioned 1px box) at a count of 0; jsdom's `toBeVisible` can't see that. */
function isResultsRowHidden() {
  // eslint-disable-next-line testing-library/no-node-access -- the row has no role; status sits in the left wrapper in the row
  const row = screen.getByRole("status").parentElement!.parentElement!;
  const style = getComputedStyle(row);
  return style.position === "absolute" && style.width === "1px";
}

describe("GamesView", () => {
  it("renders the grid, both pagination bars and opens the detail dialog from a card", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
      "GET /api/games/:id/expansions": () => jsonResponse([]),
    });
    renderWithProviders(<GamesView />);

    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Playing" })).toBeInTheDocument(); // Celeste's card status icon
    expect(screen.getByRole("img", { name: "Watchlist" })).toBeInTheDocument(); // Hades' card status icon

    await user.click(screen.getByRole("button", { name: /Hades/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(within(dialog).getByText("PC")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("shows the response's total item count in the results bar", async () => {
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 7)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("7 games");
  });

  it("requests the next page from the pagination control", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const page = Number(url.searchParams.get("page"));
        return jsonResponse(pageOf(page === 1 ? games : [games[1]], page, GAMES_PAGE_SIZE + 1));
      },
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(gamesUrls(calls)).toEqual([
      `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`,
      `/api/games?page=2&pageSize=${GAMES_PAGE_SIZE}`,
    ]);
  });

  it("shows the empty state and opens the add dialog from the FAB", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf([], 1, 0)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByText(/No games yet/)).toBeInTheDocument();
    expect(screen.queryByText(/of 0/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 games");
    expect(isResultsRowHidden()).toBe(true);

    await user.click(screen.getByRole("button", { name: "Add game" }));
    const dialog = await screen.findByRole("dialog", { name: "Add game" });
    expect(within(dialog).queryByRole("heading", { name: "Add game" })).not.toBeInTheDocument();
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
      "GET /api/games.meta": mockMeta,
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
      "GET /api/games.meta": mockMeta,
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
        return jsonResponse(pageOf(page === 1 ? games : [games[1]], page, GAMES_PAGE_SIZE + 1));
      },
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
      "DELETE /api/games/:id": () => noContent(),
      "GET /api/games/:id/expansions": () => jsonResponse([]),
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
    expect(gamesCallsAfterDelete.map((c) => c.url)).toEqual([`/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`]);
  });

  it("reloads the current page after deleting a game that was not the last one", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
      "DELETE /api/games/:id": () => noContent(),
      "GET /api/games/:id/expansions": () => jsonResponse([]),
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
    expect(gamesCalls.map((c) => c.url)).toEqual([
      `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`,
      `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`,
    ]);
    const deleteIndex = calls.findIndex((c) => c.method === "DELETE");
    expect(deleteIndex).toBeGreaterThan(0);
    expect(calls[deleteIndex + 1]?.url).toBe(`/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`);
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
      "GET /api/games.meta": mockMeta,
      "PATCH /api/games/:id": (call) => jsonResponse({ ...games[0], ...(call.body as object) }),
      "GET /api/games/:id/expansions": () => jsonResponse([]),
      "GET /api/games/title-suggestions": () => jsonResponse({ suggestions: [] }),
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Celeste/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("combobox", { name: /title/i });
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
      "GET /api/games.meta": mockMeta,
      "POST /api/games": (call) => jsonResponse({ id: "id-3", ...(call.body as object) }, 201),
      "GET /api/games/title-suggestions": () => jsonResponse({ suggestions: [] }),
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add game" }));
    const dialog = await screen.findByRole("dialog");
    const title = within(dialog).getByRole("combobox", { name: /title/i });
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
    const calls = mockApi({
      "GET /api/games": searchAwareGames,
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView searchDebounceMs={300} />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search games" }));
    await user.paste("hades");
    expect(gamesUrls(calls)).toEqual([`/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`]);

    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(gamesUrls(calls)).toEqual([
      `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`,
      `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&search=hades`,
    ]);
  });

  it("coalesces edits within the debounce window into a single request", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": searchAwareGames,
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView searchDebounceMs={300} />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search games" });
    await user.click(search);
    await user.paste("ha");
    await user.paste("des");

    await waitFor(() =>
      expect(gamesUrls(calls).filter((url) => url.includes("search="))).toEqual([
        `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&search=hades`,
      ]),
    );
  });

  it("clears the search with the clear button and drops the search param", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": searchAwareGames,
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView searchDebounceMs={300} />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search games" }));
    await user.paste("hades");
    await screen.findByRole("heading", { name: "Hades" });

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
    expect(gamesUrls(calls).at(-1)).toBe(`/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`);
  });

  it("returns to page 1 when the search term changes on a later page", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const page = Number(url.searchParams.get("page"));
        return jsonResponse(pageOf(page === 1 ? games : [games[1]], page, GAMES_PAGE_SIZE + 1));
      },
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView searchDebounceMs={300} />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
    const scrollTo = vi.spyOn(window, "scrollTo");

    await user.click(screen.getByRole("searchbox", { name: "Search games" }));
    await user.paste("hades");

    await waitFor(() =>
      expect(gamesUrls(calls)).toEqual([
        `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`,
        `/api/games?page=2&pageSize=${GAMES_PAGE_SIZE}`,
        `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&search=hades`,
      ]),
    );
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("shows the search-specific empty state when nothing matches", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games": searchAwareGames,
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
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
    const calls = mockApi({
      "GET /api/games": searchAwareGames,
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView searchDebounceMs={5000} />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search games" }));
    await user.paste("hades");
    await user.keyboard("{Enter}");

    await waitFor(
      () => expect(gamesUrls(calls)).toContain(`/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&search=hades`),
      {
        timeout: 500,
      },
    );
  });

  it("adds the selected platform as a repeated parameter to the games request", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Platform" })).not.toHaveAttribute("aria-disabled"),
    );
    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    await user.click(screen.getByRole("option", { name: "PC" }));

    await waitFor(() =>
      expect(gamesUrls(calls)).toContain(`/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&platformIds=${pc.id}`),
    );
  });

  it("reloads without the platform filter once its clear button is clicked", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Platform" })).not.toHaveAttribute("aria-disabled"),
    );
    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    await user.click(screen.getByRole("option", { name: "PC" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

    await waitFor(() =>
      expect(gamesUrls(calls)).toContain(`/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&platformIds=${pc.id}`),
    );

    await user.click(screen.getByRole("button", { name: "Clear Platform" }));
    await flushAsync();

    expect(screen.getByRole("combobox", { name: "Platform" })).toHaveTextContent("-all-");
    await waitFor(() => expect(gamesUrls(calls).at(-1)).toBe(`/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`));
  });

  it("sends two parameters when two values of one filter are selected", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Platform" })).not.toHaveAttribute("aria-disabled"),
    );
    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    await user.click(screen.getByRole("option", { name: "Nintendo" }));
    await user.click(screen.getByRole("option", { name: "PC" }));

    await waitFor(() =>
      expect(gamesUrls(calls)).toContain(
        `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&platformIds=${nintendo.id}&platformIds=${pc.id}`,
      ),
    );
  });

  it("returns to page 1 when a filter changes on a later page", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const page = Number(url.searchParams.get("page"));
        return jsonResponse(pageOf(page === 1 ? games : [games[1]], page, GAMES_PAGE_SIZE + 1));
      },
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Platform" })).not.toHaveAttribute("aria-disabled"),
    );
    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    await user.click(screen.getByRole("option", { name: "PC" }));

    await waitFor(() =>
      expect(gamesUrls(calls)).toEqual([
        `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`,
        `/api/games?page=2&pageSize=${GAMES_PAGE_SIZE}`,
        `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&platformIds=${pc.id}`,
      ]),
    );
  });

  it("shows the filter-specific empty state when a filter excludes everything", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games": (_call, url) =>
        url.searchParams.has("platformIds") ? jsonResponse(pageOf([], 1, 0)) : jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Platform" })).not.toHaveAttribute("aria-disabled"),
    );
    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    await user.click(screen.getByRole("option", { name: "PC" }));

    expect(await screen.findByText("No games match the selected filters.")).toBeInTheDocument();
    expect(screen.queryByText(/No games yet/)).not.toBeInTheDocument();
  });

  it("hides the results row for a search without matches and without status filters", async () => {
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf([], 1, 0)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView />, { route: "/games/overview?search=zzz" });

    expect(await screen.findByText('No games match "zzz"')).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 games");
    expect(isResultsRowHidden()).toBe(true);
  });

  it("keeps the toggles visible when they lead to zero results and restores the list when untoggled", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games": (_call, url) =>
        url.searchParams.has("progress") ? jsonResponse(pageOf([], 1, 0)) : jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Playing" }));

    expect(await screen.findByText("No games match the selected filters.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 games");
    expect(isResultsRowHidden()).toBe(false);
    expect(screen.getByRole("button", { name: "Playing" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Playing" }));

    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 games");
  });

  describe("URL state", () => {
    const OVERVIEW_PATH = "/games/overview";
    const twoPages = (_call: unknown, url: URL) => {
      const page = Number(url.searchParams.get("page"));
      return jsonResponse(pageOf(page === 1 ? games : [games[1]], page, GAMES_PAGE_SIZE + 1));
    };
    /** A link-like external navigation: pushes `to` onto the history. */
    function GoTo({ to }: { to: string }) {
      const navigate = useNavigate();
      return <button onClick={() => void navigate(to)}>Go to {to}</button>;
    }
    const lastGamesUrl = (calls: { url: string }[]) => new URL(gamesUrls(calls).at(-1)!, "http://localhost");
    const waitForPlatformSelect = () =>
      waitFor(() => expect(screen.getByRole("combobox", { name: "Platform" })).not.toHaveAttribute("aria-disabled"));

    it("loads the state of a deep link and shows the filters as selected", async () => {
      const calls = mockApi({
        "GET /api/games": twoPages,
        "GET /api/game-platforms": mockPlatforms,
        "GET /api/games.meta": mockMeta,
      });
      renderWithProviders(<GamesView />, {
        route: `${OVERVIEW_PATH}?search=zelda&platform=${pc.id}&ownership=owned&progress=playing&year=2017&page=2`,
      });

      expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
      expect(gamesUrls(calls)).toHaveLength(1);
      const query = new URL(gamesUrls(calls)[0], "http://localhost").searchParams;
      expect(Object.fromEntries(query)).toEqual({
        page: "2",
        pageSize: String(GAMES_PAGE_SIZE),
        search: "zelda",
        platformIds: pc.id,
        ownership: "owned",
        progress: "playing",
        releaseYear: "2017",
      });
      expect(screen.getByRole("searchbox", { name: "Search games" })).toHaveValue("zelda");
      await waitFor(() => expect(screen.getByRole("combobox", { name: "Platform" })).toHaveTextContent("PC"));
      expect(screen.getByRole("button", { name: "Owned" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Watchlist" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: "Playing" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "100%" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("combobox", { name: "Release year" })).toHaveTextContent("2017");
    });

    it("filters by progress and ownership toggles, replacing the URL and dropping the page", async () => {
      const user = userEvent.setup();
      const calls = mockApi({
        "GET /api/games": (_call, url) => {
          const page = Number(url.searchParams.get("page"));
          return jsonResponse(pageOf(page === 1 ? games : [games[1]], page, GAMES_PAGE_SIZE + 1));
        },
        "GET /api/game-platforms": mockPlatforms,
        "GET /api/games.meta": mockMeta,
      });
      renderWithProviders(
        <>
          <GamesView />
          <HistoryControls />
          <GoTo to={`${OVERVIEW_PATH}?page=2`} />
        </>,
        { route: OVERVIEW_PATH },
      );
      await screen.findByRole("heading", { name: "Celeste" });
      await user.click(screen.getByRole("button", { name: /^Go to \/games/ }));
      expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Playing" }));
      await waitFor(() =>
        expect(gamesUrls(calls).at(-1)).toBe(`/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&progress=playing`),
      );
      await user.click(screen.getByRole("button", { name: "Owned" }));
      await waitFor(() =>
        expect(gamesUrls(calls).at(-1)).toBe(
          `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&ownership=owned&progress=playing`,
        ),
      );

      expect(screen.getByRole("button", { name: "Playing" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Owned" })).toHaveAttribute("aria-pressed", "true");
      expect(currentLocation()).toBe(`${OVERVIEW_PATH}?ownership=owned&progress=playing`);

      // Replaced, not pushed: Back skips straight to the entry before the page-2 one.
      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
      expect(currentLocation()).toBe(OVERVIEW_PATH);
    });

    it("replaces the URL with the debounced search and drops the page", async () => {
      const user = userEvent.setup();
      mockApi({
        "GET /api/games": twoPages,
        "GET /api/game-platforms": mockPlatforms,
        "GET /api/games.meta": mockMeta,
      });
      renderWithProviders(
        <>
          <GamesView searchDebounceMs={300} />
          <HistoryControls />
          <GoTo to={`${OVERVIEW_PATH}?page=2`} />
        </>,
        { route: OVERVIEW_PATH },
      );
      await screen.findByRole("heading", { name: "Celeste" });
      await user.click(screen.getByRole("button", { name: /^Go to \/games/ }));
      await screen.findByRole("heading", { name: "Hades" });

      await user.click(screen.getByRole("searchbox", { name: "Search games" }));
      await user.paste("hades");
      // Positive control: the URL is untouched while the debounce is pending, and changes once it has passed.
      expect(currentLocation()).toBe(`${OVERVIEW_PATH}?page=2`);
      await waitFor(() => expect(currentLocation()).toBe(`${OVERVIEW_PATH}?search=hades`));

      // Replaced, not pushed: Back skips straight to the entry before the page-2 one.
      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
      expect(currentLocation()).toBe(OVERVIEW_PATH);
    });

    it("updates the URL and drops the page when a filter changes", async () => {
      const user = userEvent.setup();
      mockApi({
        "GET /api/games": twoPages,
        "GET /api/game-platforms": mockPlatforms,
        "GET /api/games.meta": mockMeta,
      });
      renderWithProviders(<GamesView />, { route: `${OVERVIEW_PATH}?page=2` });
      await screen.findByRole("heading", { name: "Hades" });

      await waitForPlatformSelect();
      await user.click(screen.getByRole("combobox", { name: "Platform" }));
      await user.click(screen.getByRole("option", { name: "PC" }));

      await waitFor(() => expect(currentLocation()).toBe(`${OVERVIEW_PATH}?platform=${pc.id}`));
    });

    it("pushes a history entry on a page change and Back returns to the previous page", async () => {
      const user = userEvent.setup();
      const scrollTo = vi.spyOn(window, "scrollTo");
      const calls = mockApi({
        "GET /api/games": twoPages,
        "GET /api/game-platforms": mockPlatforms,
        "GET /api/games.meta": mockMeta,
      });
      renderWithProviders(
        <>
          <GamesView />
          <HistoryControls />
        </>,
        { route: OVERVIEW_PATH },
      );
      await screen.findByRole("heading", { name: "Celeste" });

      await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
      expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
      expect(currentLocation()).toBe(`${OVERVIEW_PATH}?page=2`);
      expect(lastGamesUrl(calls).searchParams.get("page")).toBe("2");
      expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0 });
      scrollTo.mockClear();

      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
      expect(currentLocation()).toBe(OVERVIEW_PATH);
      expect(gamesUrls(calls).at(-1)).toBe(`/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("re-syncs the search box when the URL search changes from outside", async () => {
      const user = userEvent.setup();
      const calls = mockApi({
        "GET /api/games": searchAwareGames,
        "GET /api/game-platforms": mockPlatforms,
        "GET /api/games.meta": mockMeta,
      });
      const target = `${OVERVIEW_PATH}?search=hades`;
      renderWithProviders(
        <>
          <GamesView searchDebounceMs={100} />
          <HistoryControls />
          <GoTo to={target} />
        </>,
        { route: `${OVERVIEW_PATH}?search=celeste` },
      );
      await screen.findByRole("heading", { name: "Celeste" });
      const search = screen.getByRole("searchbox", { name: "Search games" });
      expect(search).toHaveValue("celeste");

      await user.click(screen.getByRole("button", { name: `Go to ${target}` }));
      expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
      expect(search).toHaveValue("hades");
      // Wait out the 100ms debounce so a stale write-back would have happened by now.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
      });
      expect(currentLocation()).toBe(target); // no write-back of the stale debounced value

      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
      expect(search).toHaveValue("celeste");
      expect(currentLocation()).toBe(`${OVERVIEW_PATH}?search=celeste`);
      expect(gamesUrls(calls).at(-1)).toContain("search=celeste");
    });

    it("keeps the search of a Forward entry reached within the debounce after Back", async () => {
      const user = userEvent.setup();
      mockApi({
        "GET /api/games": searchAwareGames,
        "GET /api/game-platforms": mockPlatforms,
        "GET /api/games.meta": mockMeta,
      });
      const target = `${OVERVIEW_PATH}?search=hades`;
      renderWithProviders(
        <>
          <GamesView searchDebounceMs={100} />
          <HistoryControls />
          <GoTo to={target} />
        </>,
        { route: OVERVIEW_PATH },
      );
      await screen.findByRole("heading", { name: "Celeste" });
      const search = screen.getByRole("searchbox", { name: "Search games" });
      const waitPastDebounce = () =>
        act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 250));
        });

      await user.click(screen.getByRole("button", { name: `Go to ${target}` }));
      expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
      await waitPastDebounce(); // the debounced value is now "hades"

      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
      expect(search).toHaveValue(""); // positive control: Back reset the box
      await user.click(screen.getByRole("button", { name: "Forward" }));
      expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
      expect(search).toHaveValue("hades");

      await waitPastDebounce();
      expect(currentLocation()).toBe(target); // not stripped by a stale write of ""
      expect(search).toHaveValue("hades");
    });

    it("keeps the page-2 history entry when Back shows stale empty data of a filter without results", async () => {
      const user = userEvent.setup();
      const threePages = (_call: unknown, url: URL) => {
        const page = Number(url.searchParams.get("page"));
        if (url.searchParams.has("platformIds")) return jsonResponse(pageOf([], 1, 0));
        return jsonResponse(pageOf(page === 1 ? games : [games[1]], page, GAMES_PAGE_SIZE * 2 + 1));
      };
      const calls = mockApi({
        "GET /api/games": threePages,
        "GET /api/game-platforms": mockPlatforms,
        "GET /api/games.meta": mockMeta,
      });
      renderWithProviders(
        <>
          <GamesView />
          <HistoryControls />
        </>,
        { route: OVERVIEW_PATH },
      );
      await screen.findByRole("heading", { name: "Celeste" });
      await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
      await waitFor(() => expect(currentLocation()).toBe(`${OVERVIEW_PATH}?page=2`));
      await user.click(screen.getAllByRole("button", { name: "Go to page 3" })[0]);
      await waitFor(() => expect(currentLocation()).toBe(`${OVERVIEW_PATH}?page=3`));
      await waitForPlatformSelect();
      await user.click(screen.getByRole("combobox", { name: "Platform" }));
      await user.click(screen.getByRole("option", { name: "PC" }));
      await user.keyboard("{Escape}");
      await waitFor(() => expect(currentLocation()).toBe(`${OVERVIEW_PATH}?platform=${pc.id}`));
      // Positive control: the empty filter result has arrived.
      await waitFor(() => expect(screen.queryByRole("heading", { name: "Hades" })).not.toBeInTheDocument());
      await flushAsync();

      await user.click(screen.getByRole("button", { name: "Back" }));
      await waitFor(() => expect(gamesUrls(calls).at(-1)).toContain("page=2"));
      await flushAsync();
      expect(currentLocation()).toBe(`${OVERVIEW_PATH}?page=2`);
    });

    it("writes a search typed again after Back, although the debounced value is still the old one", async () => {
      const user = userEvent.setup();
      mockApi({
        "GET /api/games": searchAwareGames,
        "GET /api/game-platforms": mockPlatforms,
        "GET /api/games.meta": mockMeta,
      });
      renderWithProviders(
        <>
          <GamesView searchDebounceMs={300} />
          <HistoryControls />
          <GoTo to={`${OVERVIEW_PATH}?page=2`} />
        </>,
        { route: OVERVIEW_PATH },
      );
      await screen.findByRole("heading", { name: "Celeste" });
      await user.click(screen.getByRole("button", { name: /^Go to \/games/ }));
      const search = screen.getByRole("searchbox", { name: "Search games" });
      await user.click(search);
      await user.paste("hades");
      await waitFor(() => expect(currentLocation()).toBe(`${OVERVIEW_PATH}?search=hades`));

      await user.click(screen.getByRole("button", { name: "Back" }));
      await waitFor(() => expect(search).toHaveValue(""));
      expect(currentLocation()).toBe(OVERVIEW_PATH);

      // Still inside the debounce window of the reset: the debounced value is the stale "hades".
      await user.click(search);
      await user.paste("hades");
      await waitFor(() => expect(currentLocation()).toBe(`${OVERVIEW_PATH}?search=hades`));
    });

    it("ignores junk params", async () => {
      const calls = mockApi({
        "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
        "GET /api/game-platforms": mockPlatforms,
        "GET /api/games.meta": mockMeta,
      });
      renderWithProviders(<GamesView />, { route: `${OVERVIEW_PATH}?page=-3&ownership=foo&year=abc` });
      expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
      expect(gamesUrls(calls)).toEqual([`/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}`]);
    });
  });
});
