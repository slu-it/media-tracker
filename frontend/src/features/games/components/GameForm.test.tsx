import { useState } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { platforms } from "../../../test/fixtures/games";
import type { TitleSuggestionsResponse } from "../../../types/api";
import { emptyGameDraft, type GameDraft } from "../domain/gameDraft";
import { GameForm } from "./GameForm";
import { SearchDebounceContext } from "../../../hooks/useSearchDebounceMs";

function Harness({ initial, onValidityChange }: { initial: GameDraft; onValidityChange?: (valid: boolean) => void }) {
  const [draft, setDraft] = useState<GameDraft>(initial);
  return (
    <SearchDebounceContext value={10}>
      <GameForm value={draft} onChange={setDraft} platforms={platforms} onValidityChange={onValidityChange} />
    </SearchDebounceContext>
  );
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

  it("does not overwrite the release year when a release date is already set", async () => {
    const user = userEvent.setup();
    const response: TitleSuggestionsResponse = {
      suggestions: [{ id: 5245, name: "Hollow Knight", releaseYear: 2017, verified: true }],
    };
    mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    renderWithProviders(<Harness initial={{ ...emptyGameDraft(), releaseYear: 2020, releaseDate: "2020-04-01" }} />);

    const title = screen.getByRole("combobox", { name: /title/i });
    await user.click(title);
    await user.paste("Hollow Kn");

    const option = await screen.findByRole("option", { name: /Hollow Knight/ });
    await user.click(option);

    expect(screen.getByRole("combobox", { name: /title/i })).toHaveValue("Hollow Knight");
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

describe("GameForm release date/year", () => {
  it("disables the release year while a release date is set, and clearing it re-enables the year", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/games/title-suggestions": () => jsonResponse({ suggestions: [] }) });
    renderWithProviders(<Harness initial={{ ...emptyGameDraft(), releaseYear: 2020, releaseDate: "2020-04-01" }} />);

    // MUI's non-native Select renders the combobox as a div, which jest-dom's toBeDisabled() cannot see (it only
    // recognizes real form elements), so this checks the ARIA state it exposes to assistive tech instead.
    expect(screen.getByRole("combobox", { name: /release year/i })).toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByRole("combobox", { name: /release year/i })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("reports the release date as invalid while a typed edit is rejected, and valid again once cleared", async () => {
    const user = userEvent.setup();
    const onValidityChange = vi.fn();
    mockApi({ "GET /api/games/title-suggestions": () => jsonResponse({ suggestions: [] }) });
    renderWithProviders(
      <Harness
        initial={{ ...emptyGameDraft(), releaseYear: 2020, releaseDate: "2020-04-01" }}
        onValidityChange={onValidityChange}
      />,
    );
    const releaseDate = screen.getByRole("group", { name: "Release date" });

    await user.click(within(releaseDate).getByRole("spinbutton", { name: "Year" }));
    await user.keyboard("0");
    expect(onValidityChange).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });
});
