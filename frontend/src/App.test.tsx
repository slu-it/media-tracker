import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { LANGUAGE_STORAGE_KEY } from "./i18n/language";
import { MEDIA_SUB_PAGES } from "./components/layout/mediaKinds";
import { MEDIA_TAB_STORAGE_KEY, ROOT_PATH, SUB_PAGE_STORAGE_KEYS, pathFor } from "./routes";
import { flushAsync } from "./test/flushAsync";
import { jsonResponse, mockApi } from "./test/mockFetch";
import { HistoryControls } from "./test/HistoryControls";
import { currentLocation } from "./test/currentLocation";
import { renderWithProviders } from "./test/renderWithProviders";

const emptyPage = { items: [], page: 1, pageSize: 50, totalItems: 0, totalPages: 0 };
const emptyMeta = { platforms: [], ownership: [], progress: [], releaseYears: [] };
const [OVERVIEW, WATCHLIST, RANKING] = MEDIA_SUB_PAGES.games;
const gamesApi = () => ({
  "GET /api/games": () => jsonResponse(emptyPage),
  "GET /api/game-platforms": () => jsonResponse([]),
  "GET /api/games.meta": () => jsonResponse(emptyMeta),
});
const NO_GAMES = /No games yet/;

describe("App", () => {
  it("shows the header, the tabs in order and the books view by default", () => {
    const calls = mockApi({});
    renderWithProviders(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "SLU's Media Tracker" })).toBeInTheDocument();
    // The logout form has no accessible name of its own (a bare HTML POST form), so its `action` attribute
    // is only reachable by walking up from the button that submits it.
    // eslint-disable-next-line testing-library/no-node-access -- form action isn't exposed via any ARIA role/text query
    expect(screen.getByRole("button", { name: "Log out" }).closest("form")).toHaveAttribute("action", "/logout");
    expect(screen.getByRole("button", { name: "Language" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Books", "Games", "Movies", "Series"]);
    expect(screen.getByRole("tab", { name: "Books" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(currentLocation()).toBe(pathFor("books"));
    expect(calls).toEqual([]); // no /api/me, and no games request while another tab is open
  });

  it.each([
    { path: pathFor("books"), tab: "Books" },
    { path: pathFor("movies"), tab: "Movies" },
    { path: pathFor("series"), tab: "Series" },
  ])("renders $path with the $tab tab selected and the placeholder", ({ path, tab }) => {
    mockApi({});
    renderWithProviders(<App />, { route: path });
    expect(screen.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Overview" })).not.toBeInTheDocument();
    expect(currentLocation()).toBe(path);
  });

  it.each([
    { page: OVERVIEW, tab: "Overview", text: NO_GAMES },
    { page: WATCHLIST, tab: "Watchlist", text: "Your watchlist is empty." },
    { page: RANKING, tab: "Yearly ranking", text: /^No rated games in \d{4}\.$/ },
  ])("renders the games $page route with its sub-page selected", async ({ page, tab, text }) => {
    mockApi(gamesApi());
    renderWithProviders(<App />, { route: pathFor("games", page) });
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Games" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    expect(currentLocation()).toBe(pathFor("games", page));
  });

  it("redirects / to the stored kind", () => {
    localStorage.setItem(MEDIA_TAB_STORAGE_KEY, "movies");
    mockApi({});
    renderWithProviders(<App />, { route: ROOT_PATH });
    expect(screen.getByRole("tab", { name: "Movies" })).toHaveAttribute("aria-selected", "true");
    expect(currentLocation()).toBe(pathFor("movies"));
  });

  it("redirects / to the stored kind including its stored sub-page", async () => {
    localStorage.setItem(MEDIA_TAB_STORAGE_KEY, "games");
    localStorage.setItem(SUB_PAGE_STORAGE_KEYS.games, RANKING);
    mockApi(gamesApi());
    renderWithProviders(<App />, { route: ROOT_PATH });
    expect(await screen.findByText(/^No rated games in \d{4}\.$/)).toBeInTheDocument();
    expect(currentLocation()).toBe(pathFor("games", RANKING));
  });

  it("redirects /games to the stored sub-page", async () => {
    localStorage.setItem(SUB_PAGE_STORAGE_KEYS.games, WATCHLIST);
    mockApi(gamesApi());
    renderWithProviders(<App />, { route: pathFor("games") });
    expect(await screen.findByText("Your watchlist is empty.")).toBeInTheDocument();
    expect(currentLocation()).toBe(pathFor("games", WATCHLIST));
  });

  it("redirects /games to the overview without a valid stored sub-page", async () => {
    localStorage.setItem(SUB_PAGE_STORAGE_KEYS.games, "bogus");
    mockApi(gamesApi());
    renderWithProviders(<App />, { route: pathFor("games") });
    expect(await screen.findByText(NO_GAMES)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(currentLocation()).toBe(pathFor("games", OVERVIEW));
  });

  it.each(["/nope", `${pathFor("books")}/x`, `${pathFor("games")}/nope`, `${pathFor("games", OVERVIEW)}/x`])(
    "redirects the unknown path %s to / and on to the default kind",
    (path) => {
      mockApi({});
      renderWithProviders(<App />, { route: path });
      expect(currentLocation()).toBe(pathFor("books"));
      expect(screen.getByRole("tab", { name: "Books" })).toHaveAttribute("aria-selected", "true");
    },
  );

  it("redirects an unknown path to the stored kind", () => {
    localStorage.setItem(MEDIA_TAB_STORAGE_KEY, "series");
    mockApi({});
    renderWithProviders(<App />, { route: "/nope" });
    expect(currentLocation()).toBe(pathFor("series"));
  });

  it("treats a path with different letter case as unknown and redirects to the stored kind", () => {
    localStorage.setItem(MEDIA_TAB_STORAGE_KEY, "series");
    mockApi({});
    renderWithProviders(<App />, { route: "/GAMES/overview" });
    expect(currentLocation()).toBe(pathFor("series"));
  });

  it("treats a kind path with different letter case as unknown and redirects to the stored kind", () => {
    localStorage.setItem(MEDIA_TAB_STORAGE_KEY, "series");
    mockApi({});
    renderWithProviders(<App />, { route: "/GAMES" });
    expect(currentLocation()).toBe(pathFor("series"));
  });

  it("navigates on a tab click and stores the visited kind and sub-page", async () => {
    const user = userEvent.setup();
    mockApi(gamesApi());
    renderWithProviders(<App />, { route: pathFor("books") });
    await user.click(screen.getByRole("tab", { name: "Games" }));
    expect(currentLocation()).toBe(pathFor("games", OVERVIEW));
    expect(localStorage.getItem(MEDIA_TAB_STORAGE_KEY)).toBe("games");
    expect(await screen.findByText(NO_GAMES)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Yearly ranking" }));
    expect(currentLocation()).toBe(pathFor("games", RANKING));
    expect(localStorage.getItem(SUB_PAGE_STORAGE_KEYS.games)).toBe(RANKING);
    await screen.findByText(/^No rated games in \d{4}\.$/);

    await user.click(screen.getByRole("tab", { name: "Movies" }));
    expect(currentLocation()).toBe(pathFor("movies"));
    expect(localStorage.getItem(MEDIA_TAB_STORAGE_KEY)).toBe("movies");
    // The games sub-page is kept for the next visit, and the Games tab leads back to it.
    expect(localStorage.getItem(SUB_PAGE_STORAGE_KEYS.games)).toBe(RANKING);
    await user.click(screen.getByRole("tab", { name: "Games" }));
    expect(currentLocation()).toBe(pathFor("games", RANKING));
    await screen.findByText(/^No rated games in \d{4}\.$/);
  });

  it("goes back to the previous route with the browser history", async () => {
    const user = userEvent.setup();
    mockApi(gamesApi());
    renderWithProviders(
      <>
        <App />
        <HistoryControls />
      </>,
      { route: pathFor("games", OVERVIEW) },
    );
    await screen.findByText(NO_GAMES);
    await user.click(screen.getByRole("tab", { name: "Watchlist" }));
    await screen.findByText("Your watchlist is empty.");
    await user.click(screen.getByRole("tab", { name: "Movies" }));
    expect(currentLocation()).toBe(pathFor("movies"));

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Your watchlist is empty.")).toBeInTheDocument();
    expect(currentLocation()).toBe(pathFor("games", WATCHLIST));
    expect(screen.getByRole("tab", { name: "Watchlist" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens the settings dialog with the API Keys tab on demand", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/me/api-keys": () => jsonResponse({ primary: null, secondary: null }) });
    renderWithProviders(<App />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { level: 2, name: "Settings" })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: "API Keys" })).toBeInTheDocument();
  });

  it("switches the language to German and persists it", async () => {
    const user = userEvent.setup();
    mockApi({});
    renderWithProviders(<App />);
    await user.click(screen.getByRole("button", { name: "Language" }));
    await user.click(screen.getByRole("menuitem", { name: "Deutsch" }));
    expect(await screen.findByRole("tab", { name: "Spiele" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abmelden" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("de");
    expect(localStorage.getItem("mt.language")).toBe("de");
  });

  it("closes the language menu on Escape without changing the language", async () => {
    const user = userEvent.setup();
    mockApi({});
    renderWithProviders(<App />);
    await user.click(screen.getByRole("button", { name: "Language" }));
    expect(screen.getByRole("menuitem", { name: "Deutsch" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menuitem")).not.toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "Books" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it.each(["Books", "Movies", "Series"])("shows the coming-soon placeholder for %s", async (tabName) => {
    const user = userEvent.setup();
    mockApi(gamesApi());
    renderWithProviders(<App />, { route: pathFor("games", OVERVIEW) });
    await screen.findByText(NO_GAMES);
    await user.click(screen.getByRole("tab", { name: tabName }));
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("shows the games sub-page tabs only while the games tab is active", async () => {
    const user = userEvent.setup();
    mockApi(gamesApi());
    renderWithProviders(<App />);
    expect(screen.queryByRole("tab", { name: "Overview" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Games" }));
    await screen.findByText(NO_GAMES);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Watchlist" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Yearly ranking" })).toBeInTheDocument();
    // Decorative prefix icons are aria-hidden, so the accessible names above stay exact.
    expect(
      within(screen.getByRole("tab", { name: "Overview" })).getByTestId("GridViewOutlinedIcon"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("tab", { name: "Watchlist" })).getByTestId("LibraryAddOutlinedIcon"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("tab", { name: "Yearly ranking" })).getByTestId("LeaderboardOutlinedIcon"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Movies" }));
    expect(screen.queryByRole("tab", { name: "Overview" })).not.toBeInTheDocument();
    await flushAsync();
  });
});
