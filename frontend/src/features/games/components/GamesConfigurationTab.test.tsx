import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { jsonResponse, mockApi, noContent } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GamesConfigurationTab } from "./GamesConfigurationTab";

const SUMMARIES = [
  { id: "p1", label: "Atari", associatedColor: "0070D1", gameCount: 0 },
  { id: "p2", label: "PC", associatedColor: "107C10", gameCount: 1 },
  { id: "p3", label: "Switch", associatedColor: "E60012", gameCount: 7 },
];

describe("GamesConfigurationTab", () => {
  it("lists the platforms with pluralised counts", async () => {
    mockApi({ "GET /api/game-platforms.summaries": () => jsonResponse(SUMMARIES) });
    renderWithProviders(<GamesConfigurationTab />);
    expect(await screen.findByRole("heading", { name: "Platforms" })).toBeInTheDocument();
    expect(await screen.findByText("0 games")).toBeInTheDocument();
    expect(screen.getByText("1 game")).toBeInTheDocument();
    expect(screen.getByText("7 games")).toBeInTheDocument();
  });

  it("uses the platform endpoints for rename, add and delete and reports changes", async () => {
    const calls = mockApi({
      "GET /api/game-platforms.summaries": () => jsonResponse(SUMMARIES),
      "PATCH /api/game-platforms/:id": () => jsonResponse({}),
      "POST /api/game-platforms": () => jsonResponse({}, 201),
      "DELETE /api/game-platforms/:id": () => noContent(),
    });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<GamesConfigurationTab onChanged={onChanged} />);

    await user.click(await screen.findByRole("button", { name: "Rename PC" }));
    await user.clear(screen.getByRole("textbox", { name: "Rename PC" }));
    await user.paste("Windows");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("textbox", { name: "New platform" }));
    await user.paste("Amiga");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole("button", { name: "Delete Atari" }));
    expect(screen.getByText('Delete the platform "Atari"?')).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(3));

    expect(calls.filter((call) => call.method !== "GET")).toEqual([
      { method: "PATCH", url: "/api/game-platforms/p2", body: { label: "Windows" } },
      { method: "POST", url: "/api/game-platforms", body: { label: "Amiga", associatedColor: "757575" } },
      { method: "DELETE", url: "/api/game-platforms/p1", body: undefined },
    ]);
  });
});
