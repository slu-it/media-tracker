import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { LANGUAGE_STORAGE_KEY } from "./i18n/language";
import { GAMES_SUB_PAGE_STORAGE_KEY } from "./hooks/useGamesSubPage";
import { MEDIA_TAB_STORAGE_KEY } from "./hooks/useStoredTab";
import { jsonResponse, mockApi } from "./test/mockFetch";
import { renderWithProviders } from "./test/renderWithProviders";

const emptyPage = { items: [], page: 1, pageSize: 50, totalItems: 0, totalPages: 0 };
const emptyMeta = { platforms: [], ownership: [], progress: [], releaseYears: [] };

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
    expect(calls).toEqual([]); // no /api/me, and no games request while another tab is open
  });

  it("remembers the selected tab in localStorage", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games": () => jsonResponse(emptyPage),
      "GET /api/game-platforms": () => jsonResponse([]),
      "GET /api/games.meta": () => jsonResponse(emptyMeta),
    });
    renderWithProviders(<App />);
    await user.click(screen.getByRole("tab", { name: "Games" }));
    expect(localStorage.getItem(MEDIA_TAB_STORAGE_KEY)).toBe("games");
    expect(await screen.findByText(/No games yet/)).toBeInTheDocument();
  });

  it("restores the stored tab on load", () => {
    localStorage.setItem(MEDIA_TAB_STORAGE_KEY, "movies");
    mockApi({});
    renderWithProviders(<App />);
    expect(screen.getByRole("tab", { name: "Movies" })).toHaveAttribute("aria-selected", "true");
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
    localStorage.setItem(MEDIA_TAB_STORAGE_KEY, "games");
    mockApi({
      "GET /api/games": () => jsonResponse(emptyPage),
      "GET /api/game-platforms": () => jsonResponse([]),
      "GET /api/games.meta": () => jsonResponse(emptyMeta),
    });
    renderWithProviders(<App />);
    await screen.findByText(/No games yet/);
    await user.click(screen.getByRole("tab", { name: tabName }));
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("shows the games sub-page tabs only while the games tab is active", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games": () => jsonResponse(emptyPage),
      "GET /api/game-platforms": () => jsonResponse([]),
      "GET /api/games.meta": () => jsonResponse(emptyMeta),
    });
    renderWithProviders(<App />);
    expect(screen.queryByRole("tab", { name: "Overview" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Games" }));
    await screen.findByText(/No games yet/);
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
  });

  it("switches games sub-pages and renders the right view", async () => {
    const user = userEvent.setup();
    localStorage.setItem(MEDIA_TAB_STORAGE_KEY, "games");
    mockApi({
      "GET /api/games": () => jsonResponse(emptyPage),
      "GET /api/game-platforms": () => jsonResponse([]),
      "GET /api/games.meta": () => jsonResponse(emptyMeta),
    });
    renderWithProviders(<App />);
    await screen.findByText(/No games yet/);

    await user.click(screen.getByRole("tab", { name: "Watchlist" }));
    expect(screen.getByRole("tab", { name: "Watchlist" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Your watchlist is empty.")).toBeInTheDocument();
    expect(screen.queryByText(/No games yet/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Overview" }));
    expect(await screen.findByText(/No games yet/)).toBeInTheDocument();
  });

  it("persists the selected games sub-page in localStorage across remount", async () => {
    const user = userEvent.setup();
    localStorage.setItem(MEDIA_TAB_STORAGE_KEY, "games");
    mockApi({
      "GET /api/games": () => jsonResponse(emptyPage),
      "GET /api/game-platforms": () => jsonResponse([]),
      "GET /api/games.meta": () => jsonResponse(emptyMeta),
    });
    const { unmount } = renderWithProviders(<App />);
    await screen.findByText(/No games yet/);

    await user.click(screen.getByRole("tab", { name: "Yearly ranking" }));
    expect(localStorage.getItem(GAMES_SUB_PAGE_STORAGE_KEY)).toBe("ranking");
    // The freshly mounted GamesRankingView starts its own games/meta/platforms fetches; let them settle inside
    // act before unmounting, or their resolution logs an act warning that fails the test.
    await screen.findByText(/^No rated games in \d{4}\.$/);
    unmount();

    mockApi({
      "GET /api/games": () => jsonResponse(emptyPage),
      "GET /api/game-platforms": () => jsonResponse([]),
      "GET /api/games.meta": () => jsonResponse(emptyMeta),
    });
    renderWithProviders(<App />);
    expect(screen.getByRole("tab", { name: "Yearly ranking" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText(/^No rated games in \d{4}\.$/)).toBeInTheDocument();
  });

  it("falls back to the overview sub-page for an invalid stored value", async () => {
    localStorage.setItem(MEDIA_TAB_STORAGE_KEY, "games");
    localStorage.setItem(GAMES_SUB_PAGE_STORAGE_KEY, "bogus");
    mockApi({
      "GET /api/games": () => jsonResponse(emptyPage),
      "GET /api/game-platforms": () => jsonResponse([]),
      "GET /api/games.meta": () => jsonResponse(emptyMeta),
    });
    renderWithProviders(<App />);
    expect(await screen.findByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText(/No games yet/)).toBeInTheDocument();
  });
});
