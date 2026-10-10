import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { currentLocation } from "../../test/currentLocation";
import { flushAsync } from "../../test/flushAsync";
import {
  developerSummaries,
  emptyDeveloperSummary,
  hollowKnight,
  meta,
  platforms,
  silksong,
  supergiantGames,
  teamCherry,
  teamCherryGames,
  teamCherrySummary,
} from "../../test/fixtures/games";
import { jsonResponse, mockApi, noContent, noTitleSuggestions } from "../../test/mockFetch";
import { renderWithProviders } from "../../test/renderWithProviders";
import { GamesDevelopersView } from "./GamesDevelopersView";

const emptySummary = emptyDeveloperSummary;
const cherryGames = teamCherryGames;

const SUMMARIES = "GET /api/game-developers.summaries";
const CHERRY_GAMES = `GET /api/game-developers/${teamCherry.id}/games`;

const base = () => ({
  [SUMMARIES]: () => jsonResponse(developerSummaries),
  "GET /api/game-platforms": () => jsonResponse(platforms),
  "GET /api/games.meta": () => jsonResponse(meta),
  "GET /api/games/:id/expansions": () => jsonResponse([]),
});

const cardTitles = () => screen.getAllByRole("heading", { level: 3, hidden: true }).map((h) => h.textContent);

describe("GamesDevelopersView", () => {
  it("lists every developer with the count and loads no games", async () => {
    const calls = mockApi(base());
    renderWithProviders(<GamesDevelopersView />);
    expect(await screen.findByRole("heading", { name: /^Team Cherry/ })).toBeInTheDocument();
    const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(["Émile Studio0 games", "Supergiant Games1 game", "Team Cherry2 games"]);
    expect(screen.getByRole("status")).toHaveTextContent("3 developers");
    expect(calls.some((c) => c.url.includes("game-developers/"))).toBe(false);
  });

  it("sorts by volume and back, writing the URL without a request", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<GamesDevelopersView />);
    await screen.findAllByRole("heading", { level: 2 });
    const before = calls.length;

    await user.click(screen.getByRole("button", { name: "Most games" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Team Cherry2 games",
      "Supergiant Games1 game",
      "Émile Studio0 games",
    ]);
    expect(currentLocation()).toContain("sort=volume");

    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Émile Studio0 games",
      "Supergiant Games1 game",
      "Team Cherry2 games",
    ]);
    expect(currentLocation()).not.toContain("sort");
    expect(calls).toHaveLength(before);
  });

  it("filters by search without any request", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<GamesDevelopersView />);
    await screen.findByRole("heading", { name: /^Team Cherry/ });
    const before = calls.length;

    await user.click(screen.getByRole("searchbox", { name: "Search developers" }));
    await user.paste("emile");
    await waitFor(() => expect(currentLocation()).toContain("search=emile"));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Émile Studio0 games"]);
    expect(screen.getByRole("status")).toHaveTextContent("1 developer");

    await user.clear(screen.getByRole("searchbox", { name: "Search developers" }));
    await user.paste("nothing");
    expect(await screen.findByText('No developers match "nothing"')).toBeInTheDocument();
    expect(calls).toHaveLength(before);
  });

  it("shows the empty text without developers", async () => {
    mockApi({ ...base(), [SUMMARIES]: () => jsonResponse([]) });
    renderWithProviders(<GamesDevelopersView />);
    expect(await screen.findByText("No developers yet. Add one while editing a game.")).toBeInTheDocument();
  });

  it("fetches the games only on expand and shows them in backend order", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), [CHERRY_GAMES]: () => jsonResponse(cherryGames) });
    renderWithProviders(<GamesDevelopersView />);
    await user.click(await screen.findByRole("button", { name: /Team Cherry/ }));

    expect(await screen.findByRole("heading", { name: "Hollow Knight" })).toBeInTheDocument();
    expect(calls.filter((c) => c.url === `/api/game-developers/${teamCherry.id}/games`)).toHaveLength(1);
    expect(cardTitles()).toEqual(["Hollow Knight", "Silksong"]);
  });

  it("offers edit in every section and delete only in the expanded section of a developer without games", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), [CHERRY_GAMES]: () => jsonResponse(cherryGames) });
    renderWithProviders(<GamesDevelopersView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Studio/ }));
    expect(screen.getByRole("button", { name: "Rename developer Émile Studio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete developer Émile Studio" })).toBeInTheDocument();
    expect(screen.getByText("No games by this developer")).toBeInTheDocument();
    expect(calls.some((c) => c.url === `/api/game-developers/${emptySummary.id}/games`)).toBe(false);

    await user.click(screen.getByRole("button", { name: /^Team Cherry/ }));
    expect(await screen.findByRole("button", { name: "Rename developer Team Cherry" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Delete developer / })).toHaveLength(1);
  });

  it("keeps the developer and sends no request when the delete is declined", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<GamesDevelopersView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Studio/ }));
    await user.click(await screen.findByRole("button", { name: "Delete developer Émile Studio" }));
    expect(await screen.findByText('Delete developer "Émile Studio"?')).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "No" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Delete developer Émile Studio" })).toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("deletes an unused developer and reloads the summaries", async () => {
    const user = userEvent.setup();
    let summaries = developerSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      "DELETE /api/game-developers/:id": () => noContent(),
    });
    renderWithProviders(<GamesDevelopersView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Studio/ }));
    await user.click(await screen.findByRole("button", { name: "Delete developer Émile Studio" }));
    summaries = summaries.filter((s) => s.id !== emptySummary.id);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Delete developer Émile Studio" })).not.toBeInTheDocument(),
    );
    expect(calls).toContainEqual({
      method: "DELETE",
      url: `/api/game-developers/${emptySummary.id}`,
      body: undefined,
    });
    expect(calls.filter((c) => c.url === "/api/game-developers.summaries")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: /^Émile Studio/ })).not.toBeInTheDocument();
  });

  it("shows an error, keeps the developer and reloads the summaries when the delete fails", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...base(),
      "DELETE /api/game-developers/:id": () => jsonResponse({ error: "conflict" }, 409),
    });
    renderWithProviders(<GamesDevelopersView />);
    await user.click(await screen.findByRole("button", { name: /^Émile Studio/ }));
    await user.click(await screen.findByRole("button", { name: "Delete developer Émile Studio" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Yes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Deleting failed.");
    expect(screen.getByRole("button", { name: "Delete developer Émile Studio" })).toBeEnabled();
    await waitFor(() => expect(calls.filter((c) => c.url === "/api/game-developers.summaries")).toHaveLength(2));
  });

  const openRename = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("button", { name: /^Émile Studio/ }));
    await user.click(await screen.findByRole("button", { name: "Rename developer Émile Studio" }));
    return screen.findByRole("dialog", { name: "Rename developer" });
  };

  it("renames a developer and reloads the summaries", async () => {
    const user = userEvent.setup();
    let summaries = developerSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      "PATCH /api/game-developers/:id": (call) => jsonResponse({ id: emptySummary.id, ...(call.body as object) }),
    });
    renderWithProviders(<GamesDevelopersView />);
    const dialog = await openRename(user);
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("Émile Studio");
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    summaries = summaries.map((s) => (s.id === emptySummary.id ? { ...s, name: "Renamed" } : s));
    await user.clear(name);
    await user.paste("  Renamed ");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContainEqual({
      method: "PATCH",
      url: `/api/game-developers/${emptySummary.id}`,
      body: { name: "Renamed" },
    });
    expect(await screen.findByRole("heading", { name: /^Renamed/ })).toBeInTheDocument();
    expect(calls.filter((x) => x.url === "/api/game-developers.summaries")).toHaveLength(2);
  });

  it("rejects an empty name and sends nothing", async () => {
    const user = userEvent.setup();
    const calls = mockApi(base());
    renderWithProviders(<GamesDevelopersView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    expect(within(dialog).getByText("Required")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(calls.some((x) => x.method === "PATCH")).toBe(false);
  });

  const takenBody = { error: "name_taken", existingId: supergiantGames.id, existingName: supergiantGames.name };

  const renameToTaken = async (user: ReturnType<typeof userEvent.setup>) => {
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("supergiant games");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    return dialog;
  };

  it("offers to merge when the name is taken and merges on confirm", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...base(),
      "PATCH /api/game-developers/:id": () => jsonResponse(takenBody, 409),
      "POST /api/game-developers/:id/merge": () => jsonResponse(supergiantGames),
    });
    renderWithProviders(<GamesDevelopersView />);
    await renameToTaken(user);

    const choice = await screen.findByText(/already exists/);
    expect(choice).toHaveTextContent(
      'A developer named "Supergiant Games" already exists. Merge "Émile Studio" into it?',
    );
    await user.click(screen.getByRole("button", { name: "Merge" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContainEqual({
      method: "POST",
      url: `/api/game-developers/${emptySummary.id}/merge`,
      body: { targetId: supergiantGames.id },
    });
    expect(calls.filter((x) => x.url === "/api/game-developers.summaries")).toHaveLength(2);
  });

  it("shows an error in the dialog when the merge fails", async () => {
    const user = userEvent.setup();
    mockApi({
      ...base(),
      "PATCH /api/game-developers/:id": () => jsonResponse(takenBody, 409),
      "POST /api/game-developers/:id/merge": () => jsonResponse({ error: "internal_error" }, 500),
    });
    renderWithProviders(<GamesDevelopersView />);
    const dialog = await renameToTaken(user);
    await user.click(await screen.findByRole("button", { name: "Merge" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Saving failed.");
  });

  it("collapses the merged-away developer and requests none of its games afterwards", async () => {
    const user = userEvent.setup();
    let summaries = developerSummaries;
    const calls = mockApi({
      ...base(),
      [SUMMARIES]: () => jsonResponse(summaries),
      [CHERRY_GAMES]: () => jsonResponse(cherryGames),
      "PATCH /api/game-developers/:id": () => jsonResponse(takenBody, 409),
      "POST /api/game-developers/:id/merge": () => jsonResponse(supergiantGames),
    });
    renderWithProviders(<GamesDevelopersView />);
    await user.click(await screen.findByRole("button", { name: /^Team Cherry/ }));
    await user.click(await screen.findByRole("button", { name: "Rename developer Team Cherry" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename developer" });
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("supergiant games");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    summaries = summaries.filter((x) => x.id !== teamCherry.id);
    await user.click(await screen.findByRole("button", { name: "Merge" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: /^Team Cherry/ })).not.toBeInTheDocument());
    expect(calls.filter((c) => c.url === `/api/game-developers/${teamCherry.id}/games`)).toHaveLength(1);
  });

  it("returns to the rename dialog with the typed name on Choose another name", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...base(), "PATCH /api/game-developers/:id": () => jsonResponse(takenBody, 409) });
    renderWithProviders(<GamesDevelopersView />);
    await renameToTaken(user);
    await user.click(await screen.findByRole("button", { name: "Choose another name" }));

    await waitFor(() => expect(screen.queryByText(/already exists/)).not.toBeInTheDocument());
    const again = await screen.findByRole("dialog", { name: "Rename developer" });
    expect(within(again).getByRole("textbox", { name: "Name" })).toHaveValue("supergiant games");
    expect(calls.some((x) => x.method === "POST")).toBe(false);
  });

  it("shows an error in the dialog when the rename fails", async () => {
    const user = userEvent.setup();
    mockApi({ ...base(), "PATCH /api/game-developers/:id": () => jsonResponse({ error: "internal_error" }, 500) });
    renderWithProviders(<GamesDevelopersView />);
    const dialog = await openRename(user);
    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.paste("Renamed");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Saving failed.");
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Renamed");
  });

  it("opens the detail dialog from a card", async () => {
    const user = userEvent.setup();
    mockApi({ ...base(), [CHERRY_GAMES]: () => jsonResponse(cherryGames) });
    renderWithProviders(<GamesDevelopersView />);
    await user.click(await screen.findByRole("button", { name: /Team Cherry/ }));
    await user.click(await screen.findByRole("button", { name: /Hollow Knight/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Hollow Knight" })).toBeInTheDocument();
  });

  it("reloads the summaries and the open section after a save", async () => {
    const user = userEvent.setup();
    let games = cherryGames;
    const calls = mockApi({
      ...base(),
      ...noTitleSuggestions("games"),
      [CHERRY_GAMES]: () => jsonResponse(games),
      "PATCH /api/games/:id": (call) => jsonResponse({ ...hollowKnight, title: "Renamed", ...(call.body as object) }),
    });
    renderWithProviders(<GamesDevelopersView />);
    await user.click(await screen.findByRole("button", { name: /Team Cherry/ }));
    await user.click(await screen.findByRole("button", { name: /Hollow Knight/ }));
    const dialog = await screen.findByRole("dialog");
    expect(cardTitles()).toEqual(["Hollow Knight", "Silksong"]);
    games = [silksong, hollowKnight];
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.clear(title);
    await user.paste("Renamed");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await flushAsync();

    await waitFor(() => {
      expect(calls.filter((c) => c.url === "/api/game-developers.summaries")).toHaveLength(2);
      expect(calls.filter((c) => c.url === `/api/game-developers/${teamCherry.id}/games`)).toHaveLength(2);
    });
    await waitFor(() => expect(cardTitles()).toEqual(["Silksong", "Hollow Knight"]));
  });

  it("shows an error with retry when the summaries fail", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      ...base(),
      [SUMMARIES]: () => (fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse([teamCherrySummary])),
    });
    renderWithProviders(<GamesDevelopersView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: /^Team Cherry/ })).toBeInTheDocument();
  });

  it("shows an error with retry when the games of a section fail", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      ...base(),
      [CHERRY_GAMES]: () => (fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(cherryGames)),
    });
    renderWithProviders(<GamesDevelopersView />);
    await user.click(await screen.findByRole("button", { name: /Team Cherry/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Hollow Knight" })).toBeInTheDocument();
  });
});
