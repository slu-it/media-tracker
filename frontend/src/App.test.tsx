import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { MEDIA_TAB_STORAGE_KEY } from "./hooks/useStoredTab";
import { jsonResponse, mockApi } from "./test/mockFetch";
import { renderWithProviders } from "./test/renderWithProviders";

const emptyPage = { items: [], page: 1, pageSize: 50, totalItems: 0, totalPages: 0 };

describe("App", () => {
  it("shows the header, the tabs in order and the books view by default", () => {
    const calls = mockApi({});
    renderWithProviders(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "SLU's Media Tracker" })).toBeInTheDocument();
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
});
