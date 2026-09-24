import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { platforms } from "../../../test/fixtures/games";
import type { TitleSuggestionsResponse } from "../../../types/api";
import { emptyGameDraft, type GameDraft } from "../domain/gameDraft";
import { GameForm } from "./GameForm";

function Harness({ initial }: { initial: GameDraft }) {
  const [draft, setDraft] = useState<GameDraft>(initial);
  return <GameForm value={draft} onChange={setDraft} platforms={platforms} titleSuggestionDebounceMs={10} />;
}

describe("GameForm title suggestions", () => {
  it("picking a suggestion overwrites both the title and the release year", async () => {
    const user = userEvent.setup();
    const response: TitleSuggestionsResponse = {
      suggestions: [{ id: 5245, name: "Hollow Knight", releaseYear: 2017, verified: true }],
    };
    mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    renderWithProviders(<Harness initial={{ ...emptyGameDraft(), releaseYear: 1999 }} />);

    const title = screen.getByRole("combobox", { name: /title/i });
    await user.click(title);
    await user.paste("Hollow Kn");

    const option = await screen.findByRole("option", { name: /Hollow Knight/ });
    await user.click(option);

    expect(screen.getByRole("combobox", { name: /title/i })).toHaveValue("Hollow Knight");
    expect(screen.getByRole("combobox", { name: /release year/i })).toHaveTextContent("2017");
  });

  it("keeps the existing release year when the picked suggestion has none", async () => {
    const user = userEvent.setup();
    const response: TitleSuggestionsResponse = {
      suggestions: [{ id: 42, name: "Mystery Game", releaseYear: null, verified: false }],
    };
    mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    renderWithProviders(<Harness initial={{ ...emptyGameDraft(), releaseYear: 2020 }} />);

    const title = screen.getByRole("combobox", { name: /title/i });
    await user.click(title);
    await user.paste("Myster");

    const option = await screen.findByRole("option", { name: /Mystery Game/ });
    await user.click(option);

    expect(screen.getByRole("combobox", { name: /title/i })).toHaveValue("Mystery Game");
    expect(screen.getByRole("combobox", { name: /release year/i })).toHaveTextContent("2020");
  });

  it("sends no title-suggestions request while the form just opened, before any edit", async () => {
    const calls = mockApi({
      "GET /api/games/title-suggestions": () => jsonResponse({ suggestions: [] } satisfies TitleSuggestionsResponse),
    });
    renderWithProviders(<Harness initial={{ ...emptyGameDraft(), title: "An already long, existing title" }} />);

    await flushAsync();
    expect(screen.getByRole("combobox", { name: /title/i })).toHaveValue("An already long, existing title");
    expect(calls).toHaveLength(0);
  });
});
