import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { developers, supergiantGames, teamCherry } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { apiFetch } from "../../../api/client";
import type { NamedEntry, VocabularyDraft } from "../../../domain/media/vocabularyDraft";
import { VocabularyField } from "./VocabularyField";
import { SearchDebounceContext } from "../../../hooks/useSearchDebounceMs";

// A stable module-level fetcher, as the field requires.
const fetchSuggestions = (term: string, signal: AbortSignal) =>
  apiFetch<NamedEntry[]>(`/api/game-developers?${new URLSearchParams({ search: term.trim(), limit: "10" })}`, {
    signal,
  });

/** Wraps `VocabularyField` as a controlled component, mirroring how `GameForm` will drive it. */
function ControlledDevelopersField({
  initialValue = [],
  onChange,
}: {
  initialValue?: VocabularyDraft[];
  onChange?: (value: VocabularyDraft[]) => void;
}) {
  const [value, setValue] = useState<VocabularyDraft[]>(initialValue);
  return (
    <SearchDebounceContext value={10}>
      <VocabularyField
        label="Developers"
        hint="Type to search or add"
        fetchSuggestions={fetchSuggestions}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    </SearchDebounceContext>
  );
}

describe("VocabularyField", () => {
  it("shows matching developers once the debounce settles", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "GET /api/game-developers": () => jsonResponse(developers) });
    renderWithProviders(<ControlledDevelopersField />);

    const input = screen.getByRole("combobox", { name: /developers/i });
    await user.click(input);
    await user.paste("Team");

    await waitFor(() =>
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "Team Cherry",
        "Supergiant Games",
        'Add "Team"',
      ]),
    );
    expect(calls[0].url).toBe("/api/game-developers?search=Team&limit=10");
  });

  it("adds free text that matches no suggestion as a new, outlined pending chip on Enter", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "GET /api/game-developers": () => jsonResponse([]) });
    const onChange = vi.fn();
    renderWithProviders(<ControlledDevelopersField onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: /developers/i });
    await user.click(input);
    await user.paste("New Studio");
    await waitFor(() => expect(calls).toHaveLength(1));
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([{ name: "New Studio" }]);
    // The chip itself carries no accessible role of its own; only its label text is queryable.
    // eslint-disable-next-line testing-library/no-node-access -- the chip isn't exposed via any ARIA role
    const chip = screen.getByText("New Studio").closest(".MuiChip-root");
    expect(chip).not.toBeNull();
    expect(chip).toHaveClass("MuiChip-outlined");
  });

  it("picks an existing developer when the typed text matches a suggestion, case-insensitively", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/game-developers": () => jsonResponse(developers) });
    const onChange = vi.fn();
    renderWithProviders(<ControlledDevelopersField onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: /developers/i });
    await user.click(input);
    await user.paste("team cherry");
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([teamCherry]);
  });

  it("ignores a duplicate when the typed text matches an already-selected developer", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "GET /api/game-developers": () => jsonResponse(developers) });
    const onChange = vi.fn();
    renderWithProviders(<ControlledDevelopersField initialValue={[teamCherry]} onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: /developers/i });
    await user.click(input);
    await user.paste("team cherry");
    await waitFor(() => expect(calls).toHaveLength(1));
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([teamCherry]);
    expect(screen.getAllByText("Team Cherry")).toHaveLength(1);
  });

  it("removes a developer when its chip is focused and Backspace is pressed", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/game-developers": () => jsonResponse(developers) });
    const onChange = vi.fn();
    renderWithProviders(<ControlledDevelopersField initialValue={[teamCherry, supergiantGames]} onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: /developers/i });
    await user.click(input);
    // From the empty input, ArrowLeft moves focus onto the last chip (Supergiant Games), a second ArrowLeft onto
    // the one before it (Team Cherry); Backspace then removes the focused chip.
    await user.keyboard("{ArrowLeft}{ArrowLeft}{Backspace}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([supergiantGames]);
    expect(screen.queryByText("Team Cherry")).not.toBeInTheDocument();
    expect(screen.getByText("Supergiant Games")).toBeInTheDocument();
  });

  it("upgrades a same-named pending chip to the existing developer when its suggestion is clicked", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/game-developers": () => jsonResponse(developers) });
    const onChange = vi.fn();
    renderWithProviders(<ControlledDevelopersField initialValue={[{ name: "team cherry" }]} onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: /developers/i });
    await user.click(input);
    await user.paste("Team");
    const option = await screen.findByRole("option", { name: "Team Cherry" });
    await user.click(option);

    // Upgraded in place, not toggled off (MUI's `isOptionEqualToValue` would otherwise read the click as
    // deselecting the already-"matching" pending chip) and not duplicated alongside it.
    expect(onChange).toHaveBeenCalledExactlyOnceWith([teamCherry]);
    expect(screen.queryByText("team cherry")).not.toBeInTheDocument();
    expect(screen.getAllByText("Team Cherry")).toHaveLength(1);
  });

  it('offers an "Add ..." option for typed text that matches no suggestion, and adds it as a pending chip', async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/game-developers": () => jsonResponse([]) });
    const onChange = vi.fn();
    renderWithProviders(<ControlledDevelopersField onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: /developers/i });
    await user.click(input);
    await user.paste("New Studio");
    const addOption = await screen.findByRole("option", { name: 'Add "New Studio"' });
    await user.click(addOption);

    expect(onChange).toHaveBeenCalledExactlyOnceWith([{ name: "New Studio" }]);
    expect(screen.getByText("New Studio")).toBeInTheDocument();
  });

  it("does not offer to add text that exactly matches a suggestion, case-insensitively", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/game-developers": () => jsonResponse(developers) });
    renderWithProviders(<ControlledDevelopersField />);

    const input = screen.getByRole("combobox", { name: /developers/i });
    await user.click(input);
    await user.paste("team cherry");
    await screen.findByRole("option", { name: "Team Cherry" });

    expect(screen.queryByRole("option", { name: 'Add "team cherry"' })).not.toBeInTheDocument();
  });

  it("does not offer to add text that matches an already-selected developer", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/game-developers": () => jsonResponse(developers) });
    renderWithProviders(<ControlledDevelopersField initialValue={[supergiantGames]} />);

    const input = screen.getByRole("combobox", { name: /developers/i });
    await user.click(input);
    await user.paste("Supergiant Games");
    // Positive control: the listbox is genuinely populated (with the other, still-selectable developer), so the
    // missing "Add ..." option isn't just an empty list.
    await screen.findByRole("option", { name: "Team Cherry" });

    expect(screen.queryByRole("option", { name: 'Add "Supergiant Games"' })).not.toBeInTheDocument();
  });

  it("commits valid pending text as a chip on blur", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/game-developers": () => jsonResponse([]) });
    const onChange = vi.fn();
    renderWithProviders(
      <>
        <ControlledDevelopersField onChange={onChange} />
        <button type="button">elsewhere</button>
      </>,
    );

    const input = screen.getByRole("combobox", { name: /developers/i });
    await user.click(input);
    await user.paste("Blur Studio");
    await user.click(screen.getByRole("button", { name: "elsewhere" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith([{ name: "Blur Studio" }]);
    expect(screen.getByText("Blur Studio")).toBeInTheDocument();
  });

  it("keeps the validation error and adds nothing for invalid pending text left on blur", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/game-developers": () => jsonResponse([]) });
    const onChange = vi.fn();
    renderWithProviders(
      <>
        <ControlledDevelopersField onChange={onChange} />
        <button type="button">elsewhere</button>
      </>,
    );

    const input = screen.getByRole("combobox", { name: /developers/i });
    await user.click(input);
    await user.paste("x".repeat(129));
    await user.click(screen.getByRole("button", { name: "elsewhere" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("At most 128 characters")).toBeInTheDocument();
  });

  it("shows a validation error and does not add an overlong developer name", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/game-developers": () => jsonResponse([]) });
    const onChange = vi.fn();
    renderWithProviders(<ControlledDevelopersField onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: /developers/i });
    await user.click(input);
    await user.paste("x".repeat(129));
    await user.keyboard("{Enter}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("At most 128 characters")).toBeInTheDocument();
  });
});
