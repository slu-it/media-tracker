import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { currentLocation } from "../../test/currentLocation";
import {
  emptySeriesSummary,
  hadesSeries,
  hadesSeriesGames,
  meta,
  platforms,
  seriesSummaries,
} from "../../test/fixtures/games";
import { jsonResponse, mockApi, noContent, noTitleSuggestions } from "../../test/mockFetch";
import { renderWithProviders } from "../../test/renderWithProviders";
import { GamesSeriesView } from "./GamesSeriesView";

const SUMMARIES = "GET /api/game-series.summaries";
const SERIES_GAMES = `GET /api/game-series/${hadesSeries.id}/games`;

const base = () => ({
  [SUMMARIES]: () => jsonResponse(seriesSummaries),
  "GET /api/game-platforms": () => jsonResponse(platforms),
  "GET /api/games.meta": () => jsonResponse(meta),
  "GET /api/games/:id/expansions": () => jsonResponse([]),
  ...noTitleSuggestions("games"),
});

describe("GamesSeriesView", () => {
  it("lists every series with its count and loads no games", async () => {
    const calls = mockApi(base());
    renderWithProviders(<GamesSeriesView />);
    expect(await screen.findByRole("heading", { name: /^Hades Saga/ })).toBeInTheDocument();
    const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(["Émile Chronicles0 games", "Hades Saga3 games"]);
    expect(screen.getByRole("status")).toHaveTextContent("2 series");
    expect(calls.some((c) => c.url.includes("game-series/"))).toBe(false);
  });

  it("sorts by volume and filters by search without any request", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<GamesSeriesView />);
    await screen.findAllByRole("heading", { level: 2 });
    const before = calls.length;

    await user.click(screen.getByRole("button", { name: "Most games" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Hades Saga3 games",
      "Émile Chronicles0 games",
    ]);
    expect(currentLocation()).toContain("sort=volume");

    await user.click(screen.getByRole("searchbox", { name: "Search series" }));
    await user.paste("emile");
    await waitFor(() => expect(currentLocation()).toContain("search=emile"));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Émile Chronicles0 games"]);
    expect(calls).toHaveLength(before);
  });

  it("shows the empty text without series", async () => {
    mockApi({ ...base(), [SUMMARIES]: () => jsonResponse([]) });
    renderWithProviders(<GamesSeriesView />);
    expect(await screen.findByText("No series yet. Add one while editing a game.")).toBeInTheDocument();
  });

  it("fetches the games only on expand and shows them in backend order with position badges", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), [SERIES_GAMES]: () => jsonResponse(hadesSeriesGames) });
    renderWithProviders(<GamesSeriesView />);
    await user.click(await screen.findByRole("button", { name: /Hades Saga/ }));

    expect(await screen.findByRole("heading", { name: "Hades II" })).toBeInTheDocument();
    expect(calls.filter((c) => c.url === `/api/game-series/${hadesSeries.id}/games`)).toHaveLength(1);
    const titles = screen.getAllByRole("heading", { level: 3, hidden: true }).map((h) => h.textContent);
    expect(titles).toEqual(["Hades", "Hades II", "Hades Spin-off"]);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2.5")).toBeInTheDocument();
    expect(screen.getAllByText(/^#/)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Hades II" })).toHaveAccessibleDescription("#2.5");
    // The series chip of the overview card is replaced by the badge.
    expect(screen.queryByText(/^Hades Saga #/)).not.toBeInTheDocument();
  });

  it("deletes an unused series and reloads the summaries", async () => {
    const user = userEvent.setup();
    let summaries = seriesSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      "DELETE /api/game-series/:id": () => noContent(),
    });
    renderWithProviders(<GamesSeriesView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Chronicles/ }));
    await user.click(await screen.findByRole("button", { name: "Delete series Émile Chronicles" }));
    summaries = summaries.filter((s) => s.id !== emptySeriesSummary.id);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: /^Émile Chronicles/ })).not.toBeInTheDocument());
    expect(calls).toContainEqual({
      method: "DELETE",
      url: `/api/game-series/${emptySeriesSummary.id}`,
      body: undefined,
    });
    expect(calls.filter((c) => c.url === "/api/game-series.summaries")).toHaveLength(2);
  });

  it("renames a series and offers to merge when the name is taken", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...base(),
      "PATCH /api/game-series/:id": () =>
        jsonResponse({ error: "name_taken", existingId: hadesSeries.id, existingName: hadesSeries.name }, 409),
      "POST /api/game-series/:id/merge": () => jsonResponse(hadesSeries),
    });
    renderWithProviders(<GamesSeriesView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Chronicles/ }));
    await user.click(await screen.findByRole("button", { name: "Rename series Émile Chronicles" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename series" });
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("hades saga");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/already exists/)).toHaveTextContent(
      'A series named "Hades Saga" already exists. Merge "Émile Chronicles" into it?',
    );
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContainEqual({
      method: "POST",
      url: `/api/game-series/${emptySeriesSummary.id}/merge`,
      body: { targetId: hadesSeries.id },
    });
  });

  it("opens the detail dialog from a card", async () => {
    const user = userEvent.setup();
    mockApi({ ...base(), [SERIES_GAMES]: () => jsonResponse(hadesSeriesGames) });
    renderWithProviders(<GamesSeriesView />);
    await user.click(await screen.findByRole("button", { name: /Hades Saga/ }));
    await user.click(await screen.findByRole("button", { name: "Hades II" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Hades II" })).toBeInTheDocument();
    expect(within(dialog).getByText("Hades Saga #2.5")).toBeInTheDocument();
  });

  it("shows an error with retry when the summaries fail", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      ...base(),
      [SUMMARIES]: () => (fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(seriesSummaries)),
    });
    renderWithProviders(<GamesSeriesView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: /^Hades Saga/ })).toBeInTheDocument();
  });
});
