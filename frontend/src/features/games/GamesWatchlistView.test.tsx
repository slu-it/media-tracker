import { screen, waitFor, within } from "@testing-library/react";
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
import { DEFAULT_WATCHLIST_SORT } from "./domain/gameViewParams";
import { GamesWatchlistView } from "./GamesWatchlistView";

const platforms: GamePlatformResponse[] = [pc, nintendo];
// Both watchlisted: `hades` (no exact release date, PC) and `dated` (an exact release date, Nintendo).
const dated: GameResponse = {
  ...celeste,
  id: "id-3",
  title: "Outer Wilds",
  ownership: "watchlist",
  releaseYear: 2019,
  releaseDate: "2019-05-28",
};
const games: GameResponse[] = [hades, dated];

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

/** The results row is visually hidden (absolutely positioned 1px box) at a count of 0 without `facts`; jsdom's `toBeVisible` can't see that. */
function isResultsRowHidden() {
  // eslint-disable-next-line testing-library/no-node-access -- the row has no role; status sits in the left wrapper in the row
  const row = screen.getByRole("status").parentElement!.parentElement!;
  const style = getComputedStyle(row);
  return style.position === "absolute" && style.width === "1px";
}

describe("GamesWatchlistView", () => {
  it("requests the watchlist with the default oldest-first sort", async () => {
    const calls = mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(gamesUrls(calls)).toEqual([
      `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&ownership=watchlist&sort=release_asc`,
    ]);
  });

  it("shows the response's total item count in the results bar", async () => {
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 7)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("7 games");
  });

  it("shows the release date, or the year when no date is set, and no platform chips or status icons", async () => {
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    expect(screen.getByText(String(hades.releaseYear))).toBeInTheDocument();
    expect(screen.getByText(dated.releaseDate!)).toBeInTheDocument();
    expect(screen.queryByText("Nintendo")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Watchlist" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Owned" })).not.toBeInTheDocument();
  });

  it("switches to newest-first, requests sort=release_desc and resets to page 1 from page 2", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const page = Number(url.searchParams.get("page"));
        return jsonResponse(pageOf(page === 1 ? games : [dated], page, GAMES_PAGE_SIZE + 1));
      },
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: "Outer Wilds" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Newest first" }));

    await waitFor(() =>
      expect(gamesUrls(calls)).toEqual([
        `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&ownership=watchlist&sort=release_asc`,
        `/api/games?page=2&pageSize=${GAMES_PAGE_SIZE}&ownership=watchlist&sort=release_asc`,
        `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&ownership=watchlist&sort=release_desc`,
      ]),
    );
  });

  it("keeps the sort and issues no extra request when the already-selected toggle is clicked again", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Oldest first" }));

    expect(gamesUrls(calls)).toEqual([
      `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&ownership=watchlist&sort=release_asc`,
    ]);
  });

  it("adds the selected platform filter to the request", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Platform" })).not.toHaveAttribute("aria-disabled"),
    );
    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    await user.click(screen.getByRole("option", { name: "PC" }));

    await waitFor(() =>
      expect(gamesUrls(calls)).toContain(
        `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&platformIds=${pc.id}&ownership=watchlist&sort=release_asc`,
      ),
    );
  });

  it("sends one request with the search term after the debounce and shows the matches", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const page = Number(url.searchParams.get("page"));
        const search = (url.searchParams.get("search") ?? "").toLowerCase();
        // Only "browses" Hades without a search term, so a later match for Outer Wilds proves the debounced
        // search request actually happened rather than reusing the still-visible initial page.
        if (search.length === 0) return jsonResponse(pageOf([hades], page, 1));
        const matches = games.filter((g) => g.title.toLowerCase().includes(search));
        return jsonResponse(pageOf(matches, page, matches.length));
      },
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView searchDebounceMs={300} />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search games" }));
    await user.paste("wilds");
    expect(gamesUrls(calls)).toEqual([
      `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&ownership=watchlist&sort=release_asc`,
    ]);

    expect(await screen.findByRole("heading", { name: "Outer Wilds" })).toBeInTheDocument();
    expect(gamesUrls(calls)).toEqual([
      `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&ownership=watchlist&sort=release_asc`,
      `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&search=wilds&ownership=watchlist&sort=release_asc`,
    ]);
  });

  it("shows the watchlist-empty state when nothing is on the watchlist", async () => {
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf([], 1, 0)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByText("Your watchlist is empty.")).toBeInTheDocument();
  });

  it("shows the search-specific empty state when nothing matches", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games": (_call, url) =>
        url.searchParams.has("search") ? jsonResponse(pageOf([], 1, 0)) : jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView searchDebounceMs={300} />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search games" }));
    await user.paste("zzz");

    expect(await screen.findByText('No games match "zzz"')).toBeInTheDocument();
    expect(screen.queryByText("Your watchlist is empty.")).not.toBeInTheDocument();
  });

  it("shows the filter-specific empty state when the platform filter excludes everything", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games": (_call, url) =>
        url.searchParams.has("platformIds") ? jsonResponse(pageOf([], 1, 0)) : jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Platform" })).not.toHaveAttribute("aria-disabled"),
    );
    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    await user.click(screen.getByRole("option", { name: "PC" }));

    expect(await screen.findByText("No games match the selected filters.")).toBeInTheDocument();
    expect(screen.queryByText("Your watchlist is empty.")).not.toBeInTheDocument();
  });

  it("shows the Sort order and Platform legends naming their controls", async () => {
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    expect(screen.getByText("Sort order")).toBeVisible();
    expect(screen.getByRole("group", { name: "Sort order" })).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Platform" })).toBeInTheDocument();
  });

  it("keeps the filter row visible when the platform filter has no results, so it can be undone", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games": (_call, url) =>
        url.searchParams.has("platformIds") ? jsonResponse(pageOf([], 1, 0)) : jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Platform" })).not.toHaveAttribute("aria-disabled"),
    );
    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    await user.click(screen.getByRole("option", { name: "PC" }));
    expect(await screen.findByText("No games match the selected filters.")).toBeInTheDocument();

    // A multi-select stays open after a pick, and its menu hides the page from the accessibility tree.
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("status")).toHaveTextContent("0 games");
    expect(isResultsRowHidden()).toBe(false);
    expect(screen.getByRole("group", { name: "Sort order" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear Platform" }));
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
  });

  it("hides the filter row for a watchlist without any game", async () => {
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf([], 1, 0)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByText("Your watchlist is empty.")).toBeInTheDocument();

    expect(isResultsRowHidden()).toBe(true);
    expect(screen.queryByRole("group", { name: "Sort order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Platform" })).not.toBeInTheDocument();
  });

  it("opens the detail dialog from a card", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
      "GET /api/games/:id/expansions": () => jsonResponse([]),
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hades" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Hades" })).toBeInTheDocument();
  });

  it("opens the add dialog from the FAB", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf([], 1, 0)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByText("Your watchlist is empty.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add game" }));
    const dialog = await screen.findByRole("dialog", { name: "Add game" });
    expect(within(dialog).queryByRole("heading", { name: "Add game" })).not.toBeInTheDocument();
  });

  it("shows the previous page after deleting the last game of a later page", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const page = Number(url.searchParams.get("page"));
        return jsonResponse(pageOf(page === 1 ? games : [dated], page, GAMES_PAGE_SIZE + 1));
      },
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
      "DELETE /api/games/:id": () => noContent(),
      "GET /api/games/:id/expansions": () => jsonResponse([]),
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: "Outer Wilds" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outer Wilds" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Outer Wilds"?');
    // Selects the last-mounted (topmost) portal: the confirm dialog stacked over the detail dialog.
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(calls).toContainEqual({ method: "DELETE", url: "/api/games/id-3", body: undefined });
    const deleteIndex = calls.findIndex((c) => c.method === "DELETE");
    const gamesCallsAfterDelete = calls.slice(deleteIndex + 1).filter((c) => c.url.startsWith("/api/games?"));
    expect(gamesCallsAfterDelete).toHaveLength(1);
    expect(gamesCallsAfterDelete[0].url).toContain("page=1");
  });

  it("shows no empty state while a page reload is still in flight (clearing a zero-result search)", async () => {
    const user = userEvent.setup();
    const resolvers: ((response: Response) => void)[] = [];
    mockApi({
      "GET /api/games": () => new Promise<Response>((resolve) => resolvers.push(resolve)),
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    renderWithProviders(<GamesWatchlistView searchDebounceMs={300} />);
    await waitFor(() => expect(resolvers).toHaveLength(1));
    resolvers[0](jsonResponse(pageOf(games, 1, 2)));
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await user.click(screen.getByRole("searchbox", { name: "Search games" }));
    await user.paste("zzz");
    await waitFor(() => expect(resolvers).toHaveLength(2));
    resolvers[1](jsonResponse(pageOf([], 1, 0)));
    expect(await screen.findByText('No games match "zzz"')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    // The cleared search's own request has not resolved yet: the still-loading grid must not flash the
    // watchlist-empty message even though the stale (zero-result) data would otherwise satisfy every condition.
    expect(screen.queryByText("Your watchlist is empty.")).not.toBeInTheDocument();
    await waitFor(() => expect(resolvers).toHaveLength(3));
    resolvers[2](jsonResponse(pageOf(games, 1, 2)));
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(screen.queryByText("Your watchlist is empty.")).not.toBeInTheDocument();
  });

  it("steps back to the previous page after editing the last page's only game to ownership owned", async () => {
    const user = userEvent.setup();
    let edited = false;
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const page = Number(url.searchParams.get("page"));
        if (!edited) return jsonResponse(pageOf(page === 1 ? games : [dated], page, GAMES_PAGE_SIZE + 1));
        // `dated` no longer matches ownership=watchlist once edited to "owned": only `hades` is left, one page.
        return jsonResponse(pageOf(page === 1 ? [hades] : [], page, 1));
      },
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
      "PATCH /api/games/:id": (call) => {
        edited = true;
        return jsonResponse({ ...dated, ...(call.body as object) });
      },
      "GET /api/games/:id/expansions": () => jsonResponse([]),
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findByRole("heading", { name: "Outer Wilds" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outer Wilds" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    await user.click(within(dialog).getByRole("switch", { name: "Owned" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByRole("button", { name: "Edit" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Outer Wilds" })).not.toBeInTheDocument();
    expect(calls.filter((c) => c.url.startsWith("/api/games?")).at(-1)?.url).toBe(
      `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&ownership=watchlist&sort=release_asc`,
    );
  });

  it("reloads the list after saving from the detail dialog", async () => {
    const user = userEvent.setup();
    let reloaded = false;
    const calls = mockApi({
      "GET /api/games": () => {
        const items = reloaded ? [{ ...hades, title: "Hades (Switch)" }, dated] : games;
        reloaded = true;
        return jsonResponse(pageOf(items, 1, 2));
      },
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
      "PATCH /api/games/:id": (call) => jsonResponse({ ...hades, ...(call.body as object) }),
      "GET /api/games/:id/expansions": () => jsonResponse([]),
      "GET /api/games/title-suggestions": () => jsonResponse({ suggestions: [] }),
    });
    renderWithProviders(<GamesWatchlistView />);
    expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hades" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.clear(title);
    await user.paste("Hades (Switch)");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("heading", { name: "Hades (Switch)" })).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith("/api/games?"))).toHaveLength(2));
  });

  describe("URL state", () => {
    const WATCHLIST_PATH = "/games/watchlist";
    const DESC = "release_desc";
    const twoPages = (_call: unknown, url: URL) => {
      const page = Number(url.searchParams.get("page"));
      return jsonResponse(pageOf(page === 1 ? games : [dated], page, GAMES_PAGE_SIZE + 1));
    };
    const mocks = () => ({
      "GET /api/games": twoPages,
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games.meta": mockMeta,
    });
    /** A link-like external navigation: pushes `to` onto the history. */
    function GoTo({ to }: { to: string }) {
      const navigate = useNavigate();
      return <button onClick={() => void navigate(to)}>Go to {to}</button>;
    }
    const lastGamesQuery = (calls: { url: string }[]) =>
      new URL(gamesUrls(calls).at(-1)!, "http://localhost").searchParams;
    const waitForPlatformSelect = () =>
      waitFor(() => expect(screen.getByRole("combobox", { name: "Platform" })).not.toHaveAttribute("aria-disabled"));

    it("loads the state of a deep link and shows the controls as selected", async () => {
      const calls = mockApi(mocks());
      renderWithProviders(<GamesWatchlistView />, {
        route: `${WATCHLIST_PATH}?search=outer&platform=${pc.id}&sort=${DESC}&page=2`,
      });

      expect(await screen.findByRole("heading", { name: "Outer Wilds" })).toBeInTheDocument();
      expect(gamesUrls(calls)).toHaveLength(1);
      expect(Object.fromEntries(lastGamesQuery(calls))).toEqual({
        page: "2",
        pageSize: String(GAMES_PAGE_SIZE),
        search: "outer",
        platformIds: pc.id,
        ownership: "watchlist",
        sort: DESC,
      });
      expect(screen.getByRole("searchbox", { name: "Search games" })).toHaveValue("outer");
      expect(screen.getByRole("button", { name: "Newest first" })).toHaveAttribute("aria-pressed", "true");
      await waitFor(() => expect(screen.getByRole("combobox", { name: "Platform" })).toHaveTextContent("PC"));
    });

    it("replaces the URL with the debounced search and drops the page", async () => {
      const user = userEvent.setup();
      mockApi(mocks());
      renderWithProviders(
        <>
          <GamesWatchlistView searchDebounceMs={300} />
          <HistoryControls />
          <GoTo to={`${WATCHLIST_PATH}?page=2`} />
        </>,
        { route: WATCHLIST_PATH },
      );
      await screen.findByRole("heading", { name: "Hades" });
      await user.click(screen.getByRole("button", { name: /^Go to \/games/ }));
      await screen.findByRole("heading", { name: "Outer Wilds" });

      await user.click(screen.getByRole("searchbox", { name: "Search games" }));
      await user.paste("hades");
      // Positive control: the URL is untouched while the debounce is pending, and changes once it has passed.
      expect(currentLocation()).toBe(`${WATCHLIST_PATH}?page=2`);
      await waitFor(() => expect(currentLocation()).toBe(`${WATCHLIST_PATH}?search=hades`));

      // Replaced, not pushed: Back skips straight to the entry before the page-2 one.
      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(currentLocation()).toBe(WATCHLIST_PATH);
    });

    it("replaces the URL and drops the page when the platform filter changes", async () => {
      const user = userEvent.setup();
      mockApi(mocks());
      renderWithProviders(<GamesWatchlistView />, { route: `${WATCHLIST_PATH}?page=2&sort=${DESC}` });
      await screen.findByRole("heading", { name: "Outer Wilds" });

      await waitForPlatformSelect();
      await user.click(screen.getByRole("combobox", { name: "Platform" }));
      await user.click(screen.getByRole("option", { name: "PC" }));

      await waitFor(() => expect(currentLocation()).toBe(`${WATCHLIST_PATH}?platform=${pc.id}&sort=${DESC}`));
    });

    it("replaces the URL and drops the page when the sort changes, omitting the default sort", async () => {
      const user = userEvent.setup();
      mockApi(mocks());
      renderWithProviders(
        <>
          <GamesWatchlistView />
          <HistoryControls />
        </>,
        { route: WATCHLIST_PATH },
      );
      await screen.findByRole("heading", { name: "Hades" });
      await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
      await screen.findByRole("heading", { name: "Outer Wilds" });
      expect(currentLocation()).toBe(`${WATCHLIST_PATH}?page=2`);

      await user.click(screen.getByRole("button", { name: "Newest first" }));
      await waitFor(() => expect(currentLocation()).toBe(`${WATCHLIST_PATH}?sort=${DESC}`));
      await user.click(screen.getByRole("button", { name: "Oldest first" }));
      await waitFor(() => expect(currentLocation()).toBe(WATCHLIST_PATH));

      // Both sort changes replaced the page-2 entry: one Back reaches the initial entry.
      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(currentLocation()).toBe(WATCHLIST_PATH);
    });

    it("pushes a history entry on a page change and Back returns to the previous page", async () => {
      const user = userEvent.setup();
      const scrollTo = vi.spyOn(window, "scrollTo");
      const calls = mockApi(mocks());
      renderWithProviders(
        <>
          <GamesWatchlistView />
          <HistoryControls />
        </>,
        { route: WATCHLIST_PATH },
      );
      await screen.findByRole("heading", { name: "Hades" });

      await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
      expect(await screen.findByRole("heading", { name: "Outer Wilds" })).toBeInTheDocument();
      expect(currentLocation()).toBe(`${WATCHLIST_PATH}?page=2`);
      expect(lastGamesQuery(calls).get("page")).toBe("2");
      expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0 });
      scrollTo.mockClear();

      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
      expect(currentLocation()).toBe(WATCHLIST_PATH);
      expect(lastGamesQuery(calls).get("page")).toBe("1");
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("ignores junk params", async () => {
      const calls = mockApi({ ...mocks(), "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)) });
      renderWithProviders(<GamesWatchlistView />, { route: `${WATCHLIST_PATH}?sort=title&page=0` });

      expect(await screen.findByRole("heading", { name: "Hades" })).toBeInTheDocument();
      expect(gamesUrls(calls)).toEqual([
        `/api/games?page=1&pageSize=${GAMES_PAGE_SIZE}&ownership=watchlist&sort=${DEFAULT_WATCHLIST_SORT}`,
      ]);
      expect(screen.getByRole("button", { name: "Oldest first" })).toHaveAttribute("aria-pressed", "true");
    });

    it("does not add a history entry when an automatic page correction steps back", async () => {
      const user = userEvent.setup();
      const scrollTo = vi.spyOn(window, "scrollTo");
      // Page 2 comes back empty (e.g. its last game was edited away): the view corrects to page 1.
      mockApi({
        ...mocks(),
        "GET /api/games": (_call: unknown, url: URL) => {
          const page = Number(url.searchParams.get("page"));
          return jsonResponse(pageOf(page === 1 ? games : [], page, 1));
        },
      });
      renderWithProviders(
        <>
          <GamesWatchlistView />
          <HistoryControls />
          <GoTo to={`${WATCHLIST_PATH}?page=2`} />
          <GoTo to={`${WATCHLIST_PATH}?sort=${DESC}`} />
        </>,
        { route: `${WATCHLIST_PATH}?sort=${DESC}` },
      );
      await screen.findByRole("heading", { name: "Hades" });
      await user.click(screen.getByRole("button", { name: `Go to ${WATCHLIST_PATH}?page=2` }));
      await waitFor(() => expect(currentLocation()).toBe(WATCHLIST_PATH));
      await screen.findByRole("heading", { name: "Hades" });

      // The correction replaced the `?page=2` entry: Back lands on the initial entry, not on the empty page.
      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(currentLocation()).toBe(`${WATCHLIST_PATH}?sort=${DESC}`);
      await flushAsync();
      expect(currentLocation()).toBe(`${WATCHLIST_PATH}?sort=${DESC}`);
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
