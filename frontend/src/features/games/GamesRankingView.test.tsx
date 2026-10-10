import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameMetaResponse, GamePlatformResponse, GameResponse } from "../../types/api";
import { jsonResponse, mockApi, noContent, noTitleSuggestions } from "../../test/mockFetch";
import { celeste, hades, meta, nintendo, pc } from "../../test/fixtures/games";
import { currentLocation } from "../../test/currentLocation";
import { HistoryControls } from "../../test/HistoryControls";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ALL_GAMES_PAGE_SIZE } from "./domain/gameValues";
import { GamesRankingView } from "./GamesRankingView";

// The suite fakes only `Date` (per ADR 0012's fake-timer guidance) so `flushAsync` and MUI's own timers keep
// working; `currentYear()` (and therefore every year offered/requested) resolves against this fixed instant.
const TEST_YEAR = 2026;

const gameCurrent: GameResponse = {
  ...celeste,
  id: "id-current",
  title: "Fresh Release",
  releaseYear: 2026,
  rating: 4.5,
};
const game2020: GameResponse = { ...hades, id: "id-2020", title: "Old Favorite", releaseYear: 2020, rating: 3.75 };

// meta's own releaseYears fixture is [2018, 2020]; 2030 proves a future year is never offered.
const rankingMeta: GameMetaResponse = { ...meta, releaseYears: [2018, 2020, 2030] };

function pageOf(items: GameResponse[]) {
  return { items, page: 1, pageSize: ALL_GAMES_PAGE_SIZE, totalItems: items.length, totalPages: 1 };
}

function mockGamesByYear(byYear: Record<number, GameResponse[]>) {
  return (_call: unknown, url: URL) => {
    const year = Number(url.searchParams.get("releaseYear"));
    return jsonResponse(pageOf(byYear[year] ?? []));
  };
}

function mockMeta(value: GameMetaResponse = rankingMeta) {
  return () => jsonResponse(value);
}

const platforms: GamePlatformResponse[] = [pc, nintendo];

function mockPlatforms() {
  return jsonResponse(platforms);
}

/** URLs of `GET /api/games` requests, in order. */
function gamesUrls(calls: { url: string }[]) {
  return calls.map((c) => c.url).filter((url) => url.startsWith("/api/games?"));
}

function topNavigator() {
  return screen.getByRole("group", { name: "Year selection (top)" });
}

function bottomNavigator() {
  return screen.getByRole("group", { name: "Year selection (bottom)" });
}

describe("GamesRankingView", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${TEST_YEAR}-06-15T00:00:00Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests the current year, rated only, sorted by rating, at the all-games page size", async () => {
    const calls = mockApi({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": mockGamesByYear({ [TEST_YEAR]: [gameCurrent] }),
      "GET /api/games.meta": mockMeta(),
    });
    renderWithProviders(<GamesRankingView />);

    expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();
    expect(gamesUrls(calls)).toEqual([
      `/api/games?page=1&pageSize=${ALL_GAMES_PAGE_SIZE}&releaseYear=${TEST_YEAR}&sort=rating_desc&rated=true`,
    ]);
  });

  it("shows the item count of the current year's ranking in the results bar", async () => {
    mockApi({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": mockGamesByYear({ [TEST_YEAR]: [gameCurrent, game2020] }),
      "GET /api/games.meta": mockMeta(),
    });
    renderWithProviders(<GamesRankingView />);
    expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 games");
  });

  it("does not offer a future year from meta", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": mockGamesByYear({ [TEST_YEAR]: [gameCurrent] }),
      "GET /api/games.meta": mockMeta(),
    });
    renderWithProviders(<GamesRankingView />);
    expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();

    await user.click(within(topNavigator()).getByRole("combobox", { name: "Year" }));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([String(TEST_YEAR), "2020", "2018"]);
  });

  it("requests the previous available year when the older button is clicked", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": mockGamesByYear({ [TEST_YEAR]: [gameCurrent], 2020: [game2020] }),
      "GET /api/games.meta": mockMeta(),
    });
    renderWithProviders(<GamesRankingView />);
    expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();

    await user.click(within(topNavigator()).getByRole("button", { name: "Previous year" }));

    expect(await screen.findByRole("heading", { name: "Old Favorite" })).toBeInTheDocument();
    expect(gamesUrls(calls)).toEqual([
      `/api/games?page=1&pageSize=${ALL_GAMES_PAGE_SIZE}&releaseYear=${TEST_YEAR}&sort=rating_desc&rated=true`,
      `/api/games?page=1&pageSize=${ALL_GAMES_PAGE_SIZE}&releaseYear=2020&sort=rating_desc&rated=true`,
    ]);
  });

  it("keeps both navigators in sync", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": mockGamesByYear({ [TEST_YEAR]: [gameCurrent], 2020: [game2020] }),
      "GET /api/games.meta": mockMeta(),
    });
    renderWithProviders(<GamesRankingView />);
    expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();

    await user.click(within(topNavigator()).getByRole("button", { name: "Previous year" }));
    await screen.findByRole("heading", { name: "Old Favorite" });

    expect(within(topNavigator()).getByRole("combobox", { name: "Year" })).toHaveTextContent("2020");
    expect(within(bottomNavigator()).getByRole("combobox", { name: "Year" })).toHaveTextContent("2020");
  });

  it("shows the loading skeleton, not the previous year's cards, while a new year's request is in flight", async () => {
    const user = userEvent.setup();
    const resolvers: ((response: Response) => void)[] = [];
    mockApi({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": (_call, url) => {
        const year = Number(url.searchParams.get("releaseYear"));
        if (year === TEST_YEAR) return jsonResponse(pageOf([gameCurrent]));
        return new Promise<Response>((resolve) => resolvers.push(resolve));
      },
      "GET /api/games.meta": mockMeta(),
    });
    renderWithProviders(<GamesRankingView />);
    expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();

    await user.click(within(topNavigator()).getByRole("button", { name: "Previous year" }));
    await waitFor(() => expect(resolvers).toHaveLength(1));

    // The year selection already shows 2020, but its request has not resolved yet: the previous year's card
    // must not still be showing under the new label (the skeleton renders instead).
    expect(within(topNavigator()).getByRole("combobox", { name: "Year" })).toHaveTextContent("2020");
    expect(screen.queryByRole("heading", { name: "Fresh Release" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Old Favorite" })).not.toBeInTheDocument();

    resolvers[0](jsonResponse(pageOf([game2020])));
    expect(await screen.findByRole("heading", { name: "Old Favorite" })).toBeInTheDocument();
  });

  it("keeps the results status empty while a new year's request is in flight, then shows its count", async () => {
    const user = userEvent.setup();
    const resolvers: ((response: Response) => void)[] = [];
    const game2020Second: GameResponse = { ...celeste, id: "id-2020-b", title: "Another Old", releaseYear: 2020 };
    mockApi({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": (_call, url) => {
        const year = Number(url.searchParams.get("releaseYear"));
        if (year === TEST_YEAR) return jsonResponse(pageOf([gameCurrent]));
        return new Promise<Response>((resolve) => resolvers.push(resolve));
      },
      "GET /api/games.meta": mockMeta(),
    });
    renderWithProviders(<GamesRankingView />);
    expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 game");

    await user.click(within(topNavigator()).getByRole("button", { name: "Previous year" }));
    await waitFor(() => expect(resolvers).toHaveLength(1));
    expect(screen.getByRole("status")).toHaveTextContent("");

    resolvers[0](jsonResponse(pageOf([game2020, game2020Second])));
    expect(await screen.findByRole("heading", { name: "Old Favorite" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Another Old" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 games");
  });

  it("shows the empty state for a year with no rated games", async () => {
    mockApi({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": mockGamesByYear({}),
      "GET /api/games.meta": mockMeta(),
    });
    renderWithProviders(<GamesRankingView />);
    expect(await screen.findByText(`No rated games in ${TEST_YEAR}.`)).toBeInTheDocument();
  });

  it("opens the detail dialog from a card", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": mockGamesByYear({ [TEST_YEAR]: [gameCurrent] }),
      "GET /api/games.meta": mockMeta(),
      "GET /api/games/:id/expansions": () => jsonResponse([]),
    });
    renderWithProviders(<GamesRankingView />);
    expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fresh Release" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();
  });

  it("opens the add dialog from the FAB", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": mockGamesByYear({}),
      "GET /api/games.meta": mockMeta(),
    });
    renderWithProviders(<GamesRankingView />);
    expect(await screen.findByText(`No rated games in ${TEST_YEAR}.`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add game" }));
    const dialog = await screen.findByRole("dialog", { name: "Add game" });
    expect(within(dialog).queryByRole("heading", { name: "Add game" })).not.toBeInTheDocument();
  });

  it("reloads the list and meta after saving from the detail dialog", async () => {
    const user = userEvent.setup();
    let reloaded = false;
    let metaCalls = 0;
    const calls = mockApi({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": () => {
        const items = reloaded ? [{ ...gameCurrent, title: "Fresh Release (Remastered)" }] : [gameCurrent];
        reloaded = true;
        return jsonResponse(pageOf(items));
      },
      "GET /api/games.meta": () => {
        metaCalls++;
        return jsonResponse(rankingMeta);
      },
      "PATCH /api/games/:id": (call) => jsonResponse({ ...gameCurrent, ...(call.body as object) }),
      "GET /api/games/:id/expansions": () => jsonResponse([]),
      ...noTitleSuggestions("games"),
    });
    renderWithProviders(<GamesRankingView />);
    expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fresh Release" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.clear(title);
    await user.paste("Fresh Release (Remastered)");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("heading", { name: "Fresh Release (Remastered)" })).toBeInTheDocument();
    await waitFor(() => expect(gamesUrls(calls)).toHaveLength(2));
    expect(metaCalls).toBe(2);
  });

  it("reloads the list and meta after deleting from the detail dialog", async () => {
    const user = userEvent.setup();
    let deleted = false;
    let metaCalls = 0;
    const calls = mockApi({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": () => jsonResponse(pageOf(deleted ? [] : [gameCurrent])),
      "GET /api/games.meta": () => {
        metaCalls++;
        return jsonResponse(rankingMeta);
      },
      "DELETE /api/games/:id": () => {
        deleted = true;
        return noContent();
      },
      "GET /api/games/:id/expansions": () => jsonResponse([]),
    });
    renderWithProviders(<GamesRankingView />);
    expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fresh Release" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Fresh Release"?');
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText(`No rated games in ${TEST_YEAR}.`)).toBeInTheDocument();
    expect(gamesUrls(calls)).toHaveLength(2);
    expect(metaCalls).toBe(2);
  });

  describe("URL state", () => {
    const RANKING_PATH = "/games/ranking";
    const DEEP_YEAR = 2020;
    const rankingUrl = (year: number) =>
      `/api/games?page=1&pageSize=${ALL_GAMES_PAGE_SIZE}&releaseYear=${year}&sort=rating_desc&rated=true`;
    const mocks = () => ({
      "GET /api/game-platforms": mockPlatforms,
      "GET /api/games": mockGamesByYear({ [TEST_YEAR]: [gameCurrent], [DEEP_YEAR]: [game2020] }),
      "GET /api/games.meta": mockMeta(),
    });

    it("loads the year of a deep link and shows it in the navigator", async () => {
      const calls = mockApi(mocks());
      renderWithProviders(<GamesRankingView />, { route: `${RANKING_PATH}?year=${DEEP_YEAR}` });

      expect(await screen.findByRole("heading", { name: "Old Favorite" })).toBeInTheDocument();
      expect(gamesUrls(calls)).toEqual([rankingUrl(DEEP_YEAR)]);
      expect(within(topNavigator()).getByRole("combobox", { name: "Year" })).toHaveTextContent(String(DEEP_YEAR));
      expect(within(bottomNavigator()).getByRole("combobox", { name: "Year" })).toHaveTextContent(String(DEEP_YEAR));
      // The resolved year was explicitly requested: nothing is rewritten.
      expect(currentLocation()).toBe(`${RANKING_PATH}?year=${DEEP_YEAR}`);
    });

    it("does not write the default year into the URL on load", async () => {
      mockApi(mocks());
      renderWithProviders(<GamesRankingView />, { route: RANKING_PATH });
      expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();
      expect(currentLocation()).toBe(RANKING_PATH);
    });

    it("pushes the year on an older click and Back restores the previous year and its request", async () => {
      const user = userEvent.setup();
      const calls = mockApi(mocks());
      renderWithProviders(
        <>
          <GamesRankingView />
          <HistoryControls />
        </>,
        { route: RANKING_PATH },
      );
      expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();

      await user.click(within(topNavigator()).getByRole("button", { name: "Previous year" }));
      expect(await screen.findByRole("heading", { name: "Old Favorite" })).toBeInTheDocument();
      expect(currentLocation()).toBe(`${RANKING_PATH}?year=${DEEP_YEAR}`);

      await user.click(within(bottomNavigator()).getByRole("button", { name: "Next year" }));
      expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();
      expect(currentLocation()).toBe(`${RANKING_PATH}?year=${TEST_YEAR}`);

      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(await screen.findByRole("heading", { name: "Old Favorite" })).toBeInTheDocument();
      expect(currentLocation()).toBe(`${RANKING_PATH}?year=${DEEP_YEAR}`);
      expect(gamesUrls(calls).at(-1)).toBe(rankingUrl(DEEP_YEAR));

      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();
      expect(currentLocation()).toBe(RANKING_PATH);
      expect(gamesUrls(calls).at(-1)).toBe(rankingUrl(TEST_YEAR));
    });

    it("pushes the year chosen in the select", async () => {
      const user = userEvent.setup();
      mockApi(mocks());
      renderWithProviders(<GamesRankingView />, { route: RANKING_PATH });
      await screen.findByRole("heading", { name: "Fresh Release" });

      await user.click(within(topNavigator()).getByRole("combobox", { name: "Year" }));
      await user.click(await screen.findByRole("option", { name: String(DEEP_YEAR) }));

      expect(await screen.findByRole("heading", { name: "Old Favorite" })).toBeInTheDocument();
      expect(currentLocation()).toBe(`${RANKING_PATH}?year=${DEEP_YEAR}`);
    });

    it("falls back to the current year for a junk year", async () => {
      const calls = mockApi(mocks());
      renderWithProviders(<GamesRankingView />, { route: `${RANKING_PATH}?year=abc` });

      expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();
      expect(gamesUrls(calls)).toEqual([rankingUrl(TEST_YEAR)]);
    });

    it("never requests a year outside the release-year range", async () => {
      const calls = mockApi(mocks());
      renderWithProviders(<GamesRankingView />, { route: `${RANKING_PATH}?year=12` });

      expect(await screen.findByRole("heading", { name: "Fresh Release" })).toBeInTheDocument();
      expect(gamesUrls(calls)).toEqual([rankingUrl(TEST_YEAR)]);
    });

    it("falls back to the nearest offered year for a year that is not offered", async () => {
      const calls = mockApi(mocks());
      renderWithProviders(<GamesRankingView />, { route: `${RANKING_PATH}?year=2019` });

      await waitFor(() =>
        expect(within(topNavigator()).getByRole("combobox", { name: "Year" })).toHaveTextContent(String(DEEP_YEAR)),
      );
      expect(await screen.findByRole("heading", { name: "Old Favorite" })).toBeInTheDocument();
      expect(gamesUrls(calls).at(-1)).toBe(rankingUrl(DEEP_YEAR));
      expect(currentLocation()).toBe(`${RANKING_PATH}?year=2019`);
    });
  });
});
