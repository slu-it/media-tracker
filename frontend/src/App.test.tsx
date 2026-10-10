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
const emptyMeta = { platforms: [], platformCounts: {}, ownership: [], progress: [], releaseYears: [] };
const [OVERVIEW, WATCHLIST, RANKING, DEVELOPERS] = MEDIA_SUB_PAGES.games;
const [BOOKS_OVERVIEW, BOOKS_WATCHLIST, BOOKS_AUTHORS, BOOKS_NARRATORS, BOOKS_SERIES] = MEDIA_SUB_PAGES.books;
const BOOKS_PATH = pathFor("books", BOOKS_OVERVIEW);
const gamesApi = () => ({
  "GET /api/games": () => jsonResponse(emptyPage),
  "GET /api/game-platforms": () => jsonResponse([]),
  "GET /api/games.meta": () => jsonResponse(emptyMeta),
});
const NO_GAMES = /No games yet/;
const emptyBooksMeta = { types: [], typeCounts: {}, ownership: [], progress: [], releaseYears: [] };
const booksApi = () => ({
  "GET /api/books": () => jsonResponse(emptyPage),
  "GET /api/book-types": () => jsonResponse([]),
  "GET /api/books.meta": () => jsonResponse(emptyBooksMeta),
});
const NO_BOOKS = /No books yet/;

describe("App", () => {
  it("shows the header, the tabs in order and the books view by default", async () => {
    const calls = mockApi(booksApi());
    renderWithProviders(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "SLU's Media Tracker" })).toBeInTheDocument();
    // The logout form has no accessible name of its own (a bare HTML POST form), so its `action` attribute
    // is only reachable by walking up from the button that submits it.
    // eslint-disable-next-line testing-library/no-node-access -- form action isn't exposed via any ARIA role/text query
    expect(screen.getByRole("button", { name: "Log out" }).closest("form")).toHaveAttribute("action", "/logout");
    expect(screen.getByRole("button", { name: "Language" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("tablist", { name: "Media kinds" }))
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Books", "Games", "Movies", "Series"]);
    expect(screen.getByRole("tab", { name: "Books" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tablist", { name: "Book pages" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(currentLocation()).toBe(BOOKS_PATH);
    expect(await screen.findByText(NO_BOOKS)).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    // Only the books requests: no /api/me, and no games request while another tab is open.
    expect(calls.map((c) => c.url).every((url) => url.startsWith("/api/book"))).toBe(true);
    expect(calls.map((c) => c.url)).toContain("/api/books.meta");
  });

  it("renders the books overview route with the Books tab selected and the real view", async () => {
    mockApi(booksApi());
    renderWithProviders(<App />, { route: BOOKS_PATH });
    expect(screen.getByRole("tab", { name: "Books" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText(NO_BOOKS)).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    expect(currentLocation()).toBe(BOOKS_PATH);
  });

  it.each([
    { path: pathFor("movies"), tab: "Movies" },
    { path: pathFor("series"), tab: "Series" },
  ])("renders $path with the $tab tab selected and the placeholder", ({ path, tab }) => {
    mockApi({ ...booksApi(), ...gamesApi() });
    renderWithProviders(<App />, { route: path });
    expect(screen.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(currentLocation()).toBe(path);
  });

  it("shows the books sub-page tab with its icon only for books", () => {
    mockApi({});
    renderWithProviders(<App />, { route: pathFor("movies") });
    expect(screen.queryByRole("tab", { name: "Overview" })).not.toBeInTheDocument();
  });

  it("renders the books authors route with its tab selected and the icon", async () => {
    mockApi({ ...booksApi(), "GET /api/book-authors.summaries": () => jsonResponse([]) });
    renderWithProviders(<App />, { route: pathFor("books", BOOKS_AUTHORS) });
    expect(await screen.findByText(/No authors yet/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Authors" })).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByRole("tab", { name: "Authors" })).getByTestId("PersonOutlinedIcon")).toBeInTheDocument();
    expect(currentLocation()).toBe(pathFor("books", BOOKS_AUTHORS));
  });

  it("renders the books narrators route with its tab selected and the icon", async () => {
    mockApi({ ...booksApi(), "GET /api/book-narrators.summaries": () => jsonResponse([]) });
    renderWithProviders(<App />, { route: pathFor("books", BOOKS_NARRATORS) });
    expect(await screen.findByText(/No narrators yet/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Narrators" })).toHaveAttribute("aria-selected", "true");
    expect(
      within(screen.getByRole("tab", { name: "Narrators" })).getByTestId("RecordVoiceOverOutlinedIcon"),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe(pathFor("books", BOOKS_NARRATORS));
  });

  it("renders the games developers route with its tab selected and the icon", async () => {
    mockApi({ ...gamesApi(), "GET /api/game-developers.summaries": () => jsonResponse([]) });
    renderWithProviders(<App />, { route: pathFor("games", DEVELOPERS) });
    expect(await screen.findByText(/No developers yet/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Developers" })).toHaveAttribute("aria-selected", "true");
    expect(
      within(screen.getByRole("tab", { name: "Developers" })).getByTestId("EngineeringOutlinedIcon"),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe(pathFor("games", DEVELOPERS));
  });

  it("renders the books series route with its tab selected and the icon", async () => {
    mockApi({ ...booksApi(), "GET /api/book-series.summaries": () => jsonResponse([]) });
    renderWithProviders(<App />, { route: pathFor("books", BOOKS_SERIES) });
    expect(await screen.findByText(/No series yet/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Book series" })).toHaveAttribute("aria-selected", "true");
    expect(
      within(screen.getByRole("tab", { name: "Book series" })).getByTestId("CollectionsBookmarkOutlinedIcon"),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe(pathFor("books", BOOKS_SERIES));
  });

  it("renders the books watchlist route with its sub-page selected", async () => {
    mockApi(booksApi());
    renderWithProviders(<App />, { route: pathFor("books", BOOKS_WATCHLIST) });
    expect(await screen.findByText("Your watchlist is empty.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Books" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Watchlist" })).toHaveAttribute("aria-selected", "true");
    expect(currentLocation()).toBe(pathFor("books", BOOKS_WATCHLIST));
  });

  it("redirects /books to the books overview", async () => {
    mockApi(booksApi());
    renderWithProviders(<App />, { route: pathFor("books") });
    expect(currentLocation()).toBe(BOOKS_PATH);
    await screen.findByText(NO_BOOKS); // let the books requests settle inside act
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

  it.each([
    "/nope",
    `${pathFor("books")}/x`,
    `${BOOKS_PATH}/x`,
    `${pathFor("games")}/nope`,
    `${pathFor("games", OVERVIEW)}/x`,
  ])("redirects the unknown path %s to / and on to the default kind", async (path) => {
    mockApi(booksApi());
    renderWithProviders(<App />, { route: path });
    expect(currentLocation()).toBe(BOOKS_PATH);
    expect(screen.getByRole("tab", { name: "Books" })).toHaveAttribute("aria-selected", "true");
    await screen.findByText(NO_BOOKS); // let the books requests settle inside act
  });

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
    mockApi({ ...booksApi(), ...gamesApi() });
    renderWithProviders(<App />, { route: BOOKS_PATH });
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
    mockApi({ ...booksApi(), ...gamesApi() });
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

  it("opens the settings dialog on the Password tab on demand", async () => {
    const user = userEvent.setup();
    mockApi(booksApi());
    renderWithProviders(<App />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { level: 2, name: "Settings" })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: "Password" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches the language to German and persists it", async () => {
    const user = userEvent.setup();
    mockApi(booksApi());
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
    mockApi(booksApi());
    renderWithProviders(<App />);
    await user.click(screen.getByRole("button", { name: "Language" }));
    expect(screen.getByRole("menuitem", { name: "Deutsch" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menuitem")).not.toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "Books" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it.each(["Movies", "Series"])("shows the coming-soon placeholder for %s", async (tabName) => {
    const user = userEvent.setup();
    mockApi({ ...booksApi(), ...gamesApi() });
    renderWithProviders(<App />, { route: pathFor("games", OVERVIEW) });
    await screen.findByText(NO_GAMES);
    await user.click(screen.getByRole("tab", { name: tabName }));
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("shows the sub-page tabs of the active kind only", async () => {
    const user = userEvent.setup();
    mockApi({ ...booksApi(), ...gamesApi() });
    renderWithProviders(<App />);
    expect(screen.getByRole("tablist", { name: "Book pages" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("tablist", { name: "Book pages" }))
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Overview", "Watchlist", "Authors", "Narrators", "Book series"]);
    expect(screen.queryByRole("tab", { name: "Yearly ranking" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("tab", { name: "Overview" })).getByTestId("GridViewOutlinedIcon"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Games" }));
    await screen.findByText(NO_GAMES);
    expect(screen.getByRole("tablist", { name: "Games pages" })).toBeInTheDocument();
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
