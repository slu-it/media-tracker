import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ExpansionResponse, GameDeveloperResponse, GameResponse } from "../../../types/api";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi, noContent, noTitleSuggestions } from "../../../test/mockFetch";
import {
  celeste,
  hades,
  hadesCoverOptions,
  hadesExpansion1,
  hadesExpansion2,
  hadesExpansions,
  nintendo,
  pc,
  platforms,
  supergiantGames,
  teamCherry,
} from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GameDetailDialog } from "./GameDetailDialog";

const game: GameResponse = {
  ...celeste,
  description: "A tough platformer about climbing a mountain.",
  rating: 4.5,
};

const noExpansions = {
  "GET /api/games/:id/expansions": () => jsonResponse([]),
};

/** Mirrors the host: the saved game replaces the `game` prop. */
function StatefulDialog({ initial, onSaved }: { initial: GameResponse; onSaved?: (updated: GameResponse) => void }) {
  const [current, setCurrent] = useState(initial);
  return (
    <GameDetailDialog
      game={current}
      onClose={() => {}}
      onSaved={(updated) => {
        setCurrent(updated);
        onSaved?.(updated);
      }}
      onDeleted={() => {}}
      platforms={platforms}
    />
  );
}

describe("GameDetailDialog", () => {
  it("shows the cover image but not the cover image URL as text in view mode", async () => {
    mockApi(noExpansions);
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    await flushAsync();
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByRole("img", { name: "Celeste" })).toHaveAttribute("src", game.coverImageUrl);
    expect(within(dialog).queryByText(game.coverImageUrl!)).not.toBeInTheDocument();
  });

  it("shows the rating under the cover image, in the same column, in view mode", async () => {
    mockApi(noExpansions);
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    await flushAsync();
    const dialog = screen.getByRole("dialog");

    const cover = within(dialog).getByRole("img", { name: "Celeste" });
    const rating = within(dialog).getByRole("group", { name: "Rating" });
    // The cover image sits inside a clickable button inside its own fixed-size frame, so its shared parent is
    // three levels up; the rating group sits in a wrapper (shared with the progress toggle bar), so it is two
    // levels below that parent. Verifying that is structural and has no ARIA role/text query equivalent.
    // eslint-disable-next-line testing-library/no-node-access -- structural layout check, no query alternative
    expect(rating.parentElement!.parentElement).toBe(cover.parentElement!.parentElement!.parentElement);
  });

  it("shows the rating under the cover image, in the same column, in edit mode", async () => {
    const user = userEvent.setup();
    mockApi(noExpansions);
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    // Named for assistive tech, but without a visible headline (the height goes to the form).
    expect(screen.getByRole("dialog", { name: "Edit game" })).toBe(dialog);
    expect(within(dialog).queryByRole("heading", { name: "Edit game" })).not.toBeInTheDocument();

    const cover = within(dialog).getByRole("img", { name: "Cover preview" });
    const rating = within(dialog).getByRole("group", { name: "Rating" });
    // The cover preview is now clickable (opens the cover picker), so it sits inside its own button, one level
    // deeper than before; the rating sits in a wrapper shared with the progress toggle bar.
    // eslint-disable-next-line testing-library/no-node-access -- structural layout check, no query alternative
    expect(rating.parentElement!.parentElement).toBe(cover.parentElement!.parentElement!.parentElement);
  });

  it("shows the description under the title and platform chips in view mode", async () => {
    mockApi(noExpansions);
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    await flushAsync();
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText(game.description!)).toBeInTheDocument();
    expect(within(dialog).getByText("Nintendo")).toBeInTheDocument();
  });

  it("shows developer chips and the formatted release date in view mode", async () => {
    const withDevelopers = { ...game, developers: [teamCherry, supergiantGames], releaseDate: "2018-01-25" };
    mockApi(noExpansions);
    renderWithProviders(
      <GameDetailDialog
        game={withDevelopers}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    await flushAsync();
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText(teamCherry.name)).toBeInTheDocument();
    expect(within(dialog).getByText(supergiantGames.name)).toBeInTheDocument();
    expect(within(dialog).getByText("2018-01-25")).toBeInTheDocument();
  });

  it("labels the dialog with the game's title in view mode", async () => {
    mockApi(noExpansions);
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    await flushAsync();
    expect(screen.getByRole("dialog")).toHaveAccessibleName(game.title);
  });

  it("shows the status icons in view mode", async () => {
    mockApi(noExpansions);
    renderWithProviders(
      <GameDetailDialog
        game={hades}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    await flushAsync();
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByRole("img", { name: "Watchlist" })).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: "100%" })).toBeInTheDocument();
  });

  it("shows the owned icon and the progress icon for an owned, unhidden game", async () => {
    mockApi(noExpansions);
    renderWithProviders(
      <GameDetailDialog
        game={celeste}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    await flushAsync();
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByRole("img", { name: "Playing" })).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: "Owned" })).toBeInTheDocument();
  });

  it("loads and shows a game's expansions below the platform chips", async () => {
    mockApi({ "GET /api/games/:id/expansions": () => jsonResponse(hadesExpansions) });
    renderWithProviders(
      <GameDetailDialog
        game={hades}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    const dialog = screen.getByRole("dialog");

    expect(await within(dialog).findByText(hadesExpansion1.title)).toBeInTheDocument();
    expect(within(dialog).getByText(hadesExpansion2.title)).toBeInTheDocument();
    expect(within(dialog).getByText("Expansions")).toBeInTheDocument();
  });

  it("moves an expansion via drag-and-drop and sends the target index as sequence", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/:id/expansions": () => jsonResponse(hadesExpansions),
      "PATCH /api/games/:id/expansions/:expansionId": () => jsonResponse({ ...hadesExpansion2, sequence: 0 }),
    });
    renderWithProviders(
      <GameDetailDialog
        game={hades}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByText(hadesExpansion1.title);

    const handle = within(dialog).getByRole("button", { name: `Reorder ${hadesExpansion2.title}` });
    act(() => handle.focus());
    await user.keyboard("[Space]");
    await user.keyboard("[ArrowUp]");
    await user.keyboard("[Space]");

    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1));
    expect(calls.find((c) => c.method === "PATCH")).toMatchObject({
      url: `/api/games/${hades.id}/expansions/${hadesExpansion2.id}`,
      body: { sequence: 0 },
    });
  });

  it("displays the cards in the new order after a successful drop", async () => {
    const user = userEvent.setup();
    let expansionFetches = 0;
    mockApi({
      "GET /api/games/:id/expansions": () => {
        expansionFetches += 1;
        // The real server reflects the move; the first (initial) fetch does not, later ones do.
        return jsonResponse(expansionFetches === 1 ? hadesExpansions : [hadesExpansion2, hadesExpansion1]);
      },
      "PATCH /api/games/:id/expansions/:expansionId": () => jsonResponse({ ...hadesExpansion2, sequence: 0 }),
    });
    renderWithProviders(
      <GameDetailDialog
        game={hades}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByText(hadesExpansion1.title);

    const handle = within(dialog).getByRole("button", { name: `Reorder ${hadesExpansion2.title}` });
    act(() => handle.focus());
    await user.keyboard("[Space]");
    await user.keyboard("[ArrowUp]");
    await user.keyboard("[Space]");

    await waitFor(() => expect(expansionFetches).toBe(2));
    const first = await within(dialog).findByText(hadesExpansion2.title);
    const second = within(dialog).getByText(hadesExpansion1.title);
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reverts the optimistic order and shows an error when the move fails", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games/:id/expansions": () => jsonResponse(hadesExpansions),
      "PATCH /api/games/:id/expansions/:expansionId": () =>
        jsonResponse({ error: "validation_error", message: "move rejected" }, 400),
    });
    renderWithProviders(
      <GameDetailDialog
        game={hades}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByText(hadesExpansion1.title);

    const handle = within(dialog).getByRole("button", { name: `Reorder ${hadesExpansion2.title}` });
    act(() => handle.focus());
    await user.keyboard("[Space]");
    await user.keyboard("[ArrowUp]");
    await user.keyboard("[Space]");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("move rejected");
    const first = within(dialog).getByText(hadesExpansion1.title);
    const second = within(dialog).getByText(hadesExpansion2.title);
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows an expansion added after a successful reorder", async () => {
    const user = userEvent.setup();
    const newExpansion: ExpansionResponse = {
      id: "expansion-3",
      gameId: hades.id,
      sequence: 2,
      title: "New Content",
      ownership: "watchlist",
      progress: "not_started",
    };
    let expansionFetches = 0;
    mockApi({
      "GET /api/games/:id/expansions": () => {
        expansionFetches += 1;
        if (expansionFetches === 1) return jsonResponse(hadesExpansions);
        if (expansionFetches === 2) return jsonResponse([hadesExpansion2, hadesExpansion1]);
        return jsonResponse([hadesExpansion2, hadesExpansion1, newExpansion]);
      },
      "PATCH /api/games/:id/expansions/:expansionId": () => jsonResponse({ ...hadesExpansion2, sequence: 0 }),
      "POST /api/games/:gameId/expansions": (call) =>
        jsonResponse({ id: newExpansion.id, gameId: hades.id, sequence: 2, ...(call.body as object) }, 201),
      // No title-suggestions mock: the add-expansion dialog renders `GameTitleField` without `onSuggestionPick`,
      // so it must never request suggestions; `mockApi`'s "unmocked request throws" guard would catch it if it did.
    });
    renderWithProviders(
      <GameDetailDialog
        game={hades}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByText(hadesExpansion1.title);

    const handle = within(dialog).getByRole("button", { name: `Reorder ${hadesExpansion2.title}` });
    act(() => handle.focus());
    await user.keyboard("[Space]");
    await user.keyboard("[ArrowUp]");
    await user.keyboard("[Space]");
    await waitFor(() => expect(expansionFetches).toBe(2));

    await user.click(within(dialog).getByRole("button", { name: "Add expansion" }));
    const addDialog = await screen.findByRole("dialog", { name: "Add expansion" });
    await user.click(within(addDialog).getByRole("textbox", { name: /title/i }));
    await user.paste(newExpansion.title);
    await user.click(within(addDialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(expansionFetches).toBe(3));
    expect(await within(dialog).findByText(newExpansion.title)).toBeInTheDocument();
  });

  it("shows the new values in view mode after editing an expansion", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/games/:id/expansions": () => jsonResponse(hadesExpansions),
      "PATCH /api/games/:gameId/expansions/:id": (call) =>
        jsonResponse({ ...hadesExpansion1, ...(call.body as object) }),
    });
    renderWithProviders(
      <GameDetailDialog
        game={hades}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByText(hadesExpansion1.title);

    await user.click(within(dialog).getByRole("button", { name: hadesExpansion1.title }));
    const expansionDialog = await screen.findByRole("dialog", { name: "Expansion details" });
    await user.click(within(expansionDialog).getByRole("button", { name: "Edit" }));
    await user.click(
      within(within(expansionDialog).getByRole("group", { name: "Progress" })).getByRole("button", {
        name: "Finished",
      }),
    );
    await user.click(within(expansionDialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(within(expansionDialog).getByRole("button", { name: "Finished" })).toHaveAttribute("aria-pressed", "true"),
    );
    expect(within(expansionDialog).getByRole("button", { name: "Not started" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows no expansion heading for a game with no expansions", async () => {
    const calls = mockApi(noExpansions);
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(calls).toHaveLength(1));

    expect(within(dialog).queryByText("Expansions")).not.toBeInTheDocument();
  });

  it("opens the expansion dialog in add mode from the add-expansion action button", async () => {
    const user = userEvent.setup();
    mockApi(noExpansions);
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    expect(screen.queryByRole("dialog", { name: "Add expansion" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Add expansion" }));

    expect(await screen.findByRole("dialog", { name: "Add expansion" })).toBeInTheDocument();
  });

  it("sends only the changed progress when editing solely the progress field", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...noExpansions,
      "PATCH /api/games/:id": (call) => jsonResponse({ ...game, ...(call.body as object) }),
    });
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.click(
      within(within(dialog).getByRole("group", { name: "Progress" })).getByRole("button", { name: "Finished" }),
    );
    expect(calls.filter((c) => c.method === "PATCH")).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1));
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ progress: "finished" });
  });

  it("edits and saves only the changed fields, then returns to view mode", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const calls = mockApi({
      ...noExpansions,
      ...noTitleSuggestions("games"), // the title below is edited to 5+ characters
      "PATCH /api/games/:id": (call) => jsonResponse({ ...game, ...(call.body as object) }),
    });
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={onSaved} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    expect(within(dialog).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled(); // nothing changed yet

    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.clear(title);
    await user.paste("Celeste (Switch)");
    await user.clear(within(dialog).getByRole("textbox", { name: /cover image url/i }));
    expect(save).toBeEnabled();

    await user.click(save);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(calls.filter((c) => c.method === "PATCH")).toEqual([
      { method: "PATCH", url: "/api/games/id-1", body: { title: "Celeste (Switch)", coverImageUrl: null } },
    ]);
    expect(onSaved.mock.calls[0][0]).toMatchObject({ title: "Celeste (Switch)", coverImageUrl: null });
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("sends platformIds when the platform selection changes", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...noExpansions,
      "PATCH /api/games/:id": (call) => jsonResponse({ ...game, ...(call.body as object) }),
    });
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.click(within(dialog).getByRole("combobox", { name: /platforms/i }));
    await user.click(screen.getByRole("option", { name: "PC" }));

    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1));
    expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({
      platformIds: expect.arrayContaining([nintendo.id, pc.id]) as unknown,
    });
  });

  it("sends the reduced developerIds after removing a developer chip", async () => {
    const user = userEvent.setup();
    const withDevelopers = { ...game, developers: [teamCherry, supergiantGames] };
    const calls = mockApi({
      ...noExpansions,
      "PATCH /api/games/:id": (call) => jsonResponse({ ...withDevelopers, ...(call.body as object) }),
    });
    renderWithProviders(
      <GameDetailDialog
        game={withDevelopers}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    // eslint-disable-next-line testing-library/no-node-access -- the chip's delete affordance carries no queryable role
    const chip = within(dialog).getByText(teamCherry.name).closest(".MuiChip-root");
    await user.click(within(chip as HTMLElement).getByTestId("CancelIcon"));

    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1));
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ developerIds: [supergiantGames.id] });
  });

  it("creates a pending developer before saving and includes its id in developerIds", async () => {
    const user = userEvent.setup();
    const createdDeveloper: GameDeveloperResponse = { id: "developer-3", name: "New Studio" };
    const calls = mockApi({
      ...noExpansions,
      "GET /api/game-developers": () => jsonResponse([]),
      "POST /api/game-developers": (call) => jsonResponse({ ...createdDeveloper, ...(call.body as object) }, 201),
      "PATCH /api/games/:id": (call) => jsonResponse({ ...game, ...(call.body as object) }),
    });
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.click(within(dialog).getByRole("combobox", { name: /developers/i }));
    await user.paste("New Studio");
    await user.keyboard("{Enter}");

    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1));

    const postIndex = calls.findIndex((c) => c.method === "POST" && c.url === "/api/game-developers");
    const patchIndex = calls.findIndex((c) => c.method === "PATCH");
    expect(postIndex).not.toBe(-1);
    expect(postIndex).toBeLessThan(patchIndex);
    expect(calls[postIndex].body).toEqual({ name: "New Studio" });
    expect(calls[patchIndex].body).toEqual({ developerIds: [createdDeveloper.id] });
  });

  it("shows an error and sends no PATCH when creating a pending developer fails", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...noExpansions,
      "GET /api/game-developers": () => jsonResponse([]),
      "POST /api/game-developers": () => jsonResponse({ error: "internal_error" }, 500),
    });
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.click(within(dialog).getByRole("combobox", { name: /developers/i }));
    await user.paste("New Studio");
    await user.keyboard("{Enter}");

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Saving failed.");
    expect(calls.filter((c) => c.method === "PATCH")).toEqual([]);
  });

  it("does not send developerIds when the developer selection is unchanged", async () => {
    const user = userEvent.setup();
    const withDevelopers = { ...game, developers: [teamCherry, supergiantGames] };
    const calls = mockApi({
      ...noExpansions,
      "PATCH /api/games/:id": (call) => jsonResponse({ ...withDevelopers, ...(call.body as object) }),
    });
    renderWithProviders(
      <GameDetailDialog
        game={withDevelopers}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.click(
      within(within(dialog).getByRole("group", { name: "Progress" })).getByRole("button", { name: "Finished" }),
    );
    expect(calls.filter((c) => c.method === "PATCH")).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1));
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ progress: "finished" });
  });

  it("clears the description when emptied", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...noExpansions,
      "PATCH /api/games/:id": (call) => jsonResponse({ ...game, ...(call.body as object) }),
    });
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.clear(within(dialog).getByRole("textbox", { name: /description/i }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1));
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ description: null });
  });

  it("keeps the save button disabled while the draft is invalid and shows backend errors", async () => {
    const user = userEvent.setup();
    mockApi({
      ...noExpansions,
      "PATCH /api/games/:id": () => jsonResponse({ error: "validation_error", message: "title: nope" }, 400),
    });
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.clear(title);
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();

    await user.type(title, "X");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("title: nope");
    expect(within(dialog).getByRole("combobox", { name: /title/i })).toBeInTheDocument(); // still editing
  });

  it("disables save while a picked release date is invalid, and re-enables once formValid resets on re-edit", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...noExpansions, ...noTitleSuggestions("games") });
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const save = within(dialog).getByRole("button", { name: "Save" });

    // ArrowUp fills an empty section with a default (today's year/month/day), giving a full valid date without
    // typing a fresh multi-digit section, which is flaky to drive through jsdom (see ReleaseDateField.test.tsx).
    const releaseDate = within(dialog).getByRole("group", { name: "Release date" });
    await user.click(within(releaseDate).getByRole("spinbutton", { name: "Year" }));
    await user.keyboard("{ArrowUp}{ArrowRight}{ArrowUp}{ArrowRight}{ArrowUp}");
    expect(save).toBeEnabled();

    await user.click(within(releaseDate).getByRole("spinbutton", { name: "Year" }));
    await user.keyboard("0");
    expect(save).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();

    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.clear(title);
    await user.paste("Celeste (changed)");

    expect(within(dialog).getByRole("button", { name: "Save" })).toBeEnabled();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("asks for confirmation before deleting, in view and in edit mode", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const calls = mockApi({ ...noExpansions, "DELETE /api/games/:id": () => noContent() });
    renderWithProviders(
      <GameDetailDialog
        game={game}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={onDeleted}
        platforms={platforms}
      />,
    );
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Celeste"?');
    // Selects the last-mounted (topmost) portal: the confirm dialog stacked over the detail dialog.
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "No" }));
    await waitFor(() => expect(screen.queryByText('Delete "Celeste"?')).not.toBeInTheDocument());
    expect(calls.filter((c) => c.method === "DELETE")).toEqual([]);
    expect(onDeleted).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Celeste"?');
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledExactlyOnceWith("id-1"));
    expect(calls.filter((c) => c.method === "DELETE")).toEqual([
      { method: "DELETE", url: "/api/games/id-1", body: undefined },
    ]);
  });

  it("cancel discards the edits and returns to view mode", async () => {
    const user = userEvent.setup();
    // The title below is edited to 5+ characters.
    const calls = mockApi({ ...noExpansions, ...noTitleSuggestions("games") });
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("combobox", { name: /title/i });
    await user.clear(title);
    await user.paste("Celeste (changed)");

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Celeste")).toBeInTheDocument();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("closes without saving", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    // The title below is edited (appended to), staying at 5+ characters.
    const calls = mockApi({ ...noExpansions, ...noTitleSuggestions("games") });
    renderWithProviders(
      <GameDetailDialog game={game} onClose={onClose} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByRole("combobox", { name: /title/i }), "!");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("opens the cover picker from the placeholder cover of a game without a cover", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/:id/expansions": () => jsonResponse([]),
      "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions),
    });
    renderWithProviders(
      <GameDetailDialog
        game={hades}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Choose a cover image" }));

    expect(await screen.findByText("Choose a cover")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.some((c) => c.url === `/api/games/cover-options?query=${hades.title}&releaseYear=${hades.releaseYear}`),
      ).toBe(true),
    );
  });

  it("closes the cover picker and reports the patched game after picking a cover", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const updated = { ...hades, coverImageUrl: hadesCoverOptions.covers.items[0].imageUrl };
    mockApi({
      "GET /api/games/:id/expansions": () => jsonResponse([]),
      "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions),
      "PATCH /api/games/:id": () => jsonResponse(updated),
    });
    renderWithProviders(
      <GameDetailDialog game={hades} onClose={() => {}} onSaved={onSaved} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Choose a cover image" }));
    await screen.findByText("Choose a cover");
    await user.click(await screen.findByRole("button", { name: "Use cover 1" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledExactlyOnceWith(updated));
    await waitFor(() => expect(screen.queryByText("Choose a cover")).not.toBeInTheDocument());
  });

  it("a failed cover save keeps the picker open and does not call onSaved", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mockApi({
      "GET /api/games/:id/expansions": () => jsonResponse([]),
      "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions),
      "PATCH /api/games/:id": () => jsonResponse({ error: "internal_error" }, 500),
    });
    renderWithProviders(
      <GameDetailDialog game={hades} onClose={() => {}} onSaved={onSaved} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Choose a cover image" }));
    await screen.findByText("Choose a cover");
    await user.click(await screen.findByRole("button", { name: "Use cover 1" }));

    expect(await screen.findByText("Saving failed.")).toBeInTheDocument();
    expect(screen.getByText("Choose a cover")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("in edit mode picking a cover fills the url field without saving", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games/:id/expansions": () => jsonResponse([]),
      "GET /api/games/cover-options": () => jsonResponse(hadesCoverOptions),
    });
    renderWithProviders(
      <GameDetailDialog
        game={hades}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        platforms={platforms}
      />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.click(within(dialog).getByRole("button", { name: "Choose a cover image" }));
    await screen.findByText("Choose a cover");
    await user.click(await screen.findByRole("button", { name: "Use cover 1" }));

    expect(within(dialog).getByRole("textbox", { name: /cover image url/i })).toHaveValue(
      hadesCoverOptions.covers.items[0].imageUrl,
    );
    expect(calls.filter((c) => c.method === "PATCH")).toEqual([]);
  });

  // MUI Rating takes the hovered value over the radio's own value, and a pointer hover yields NaN in jsdom
  // (zero-sized boxes), so `user.click` on a star is unusable. `fireEvent.click` on the quarter-star radio
  // ("<n> Stars") skips the hover; re-clicking the checked radio needs a non-zero clientX/Y, else MUI treats the
  // click as a keyboard event and ignores it.
  describe("quick rating", () => {
    const rated: GameResponse = { ...game, rating: 4.5 };

    it("PATCHes only the rating on selecting stars and stays in view mode", async () => {
      const onSaved = vi.fn();
      const calls = mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": (call) => jsonResponse({ ...rated, ...(call.body as object) }),
      });
      renderWithProviders(<StatefulDialog initial={rated} onSaved={onSaved} />);
      const dialog = screen.getByRole("dialog");

      fireEvent.click(within(dialog).getByRole("radio", { name: "4 Stars" }), { clientX: 1, clientY: 1 });
      await flushAsync();

      expect(calls.filter((c) => c.method === "PATCH")).toEqual([
        { method: "PATCH", url: "/api/games/id-1", body: { rating: 4 } },
      ]);
      expect(onSaved).toHaveBeenCalledOnce();
      expect(onSaved.mock.calls[0][0]).toMatchObject({ rating: 4 });
      expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
      expect(within(dialog).getByText("4")).toBeInTheDocument();
    });

    it("clears the rating when the current value is clicked again", async () => {
      const calls = mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": (call) => jsonResponse({ ...rated, ...(call.body as object) }),
      });
      renderWithProviders(<StatefulDialog initial={rated} />);
      const dialog = screen.getByRole("dialog");

      fireEvent.click(within(dialog).getByRole("radio", { name: "4.5 Stars" }), { clientX: 1, clientY: 1 });
      await flushAsync();

      expect(calls.filter((c) => c.method === "PATCH")).toEqual([
        { method: "PATCH", url: "/api/games/id-1", body: { rating: null } },
      ]);
      expect(within(dialog).getByText("Not rated yet")).toBeInTheDocument();
    });

    it("shows the error and reverts the displayed rating on a failed save", async () => {
      const onSaved = vi.fn();
      mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": () => jsonResponse({ error: "validation_error", message: "rating: nope" }, 400),
      });
      renderWithProviders(
        <GameDetailDialog
          game={rated}
          onClose={() => {}}
          onSaved={onSaved}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");

      fireEvent.click(within(dialog).getByRole("radio", { name: "4 Stars" }), { clientX: 1, clientY: 1 });
      await flushAsync();

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("rating: nope");
      expect(onSaved).not.toHaveBeenCalled();
      expect(within(dialog).getByText("4.5")).toBeInTheDocument();
      expect(within(dialog).getByRole("radio", { name: "4.5 Stars" })).toBeChecked();
    });

    it("blocks further changes and sends no second PATCH while a rating or progress save is pending", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const onSaved = vi.fn();
      let resolvePatch!: (response: Response) => void;
      const calls = mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": () =>
          new Promise<Response>((resolve) => {
            resolvePatch = resolve;
          }),
      });
      renderWithProviders(
        <GameDetailDialog
          game={rated}
          onClose={() => {}}
          onSaved={onSaved}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");

      fireEvent.click(within(dialog).getByRole("radio", { name: "4 Stars" }), { clientX: 1, clientY: 1 });

      // The optimistic overlay shows the new rating; the group stays enabled but busy.
      expect(within(dialog).getByRole("radio", { name: "4 Stars" })).toBeChecked();
      expect(within(dialog).getByText("4")).toBeInTheDocument();
      expect(within(dialog).getByRole("group", { name: "Rating" })).toHaveAttribute("aria-busy", "true");
      expect(within(dialog).getByRole("radio", { name: "3 Stars" })).toBeEnabled();
      fireEvent.click(within(dialog).getByRole("radio", { name: "3 Stars" }), { clientX: 1, clientY: 1 });
      expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
      await user.click(within(dialog).getByRole("button", { name: "Finished" }));
      expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1);

      resolvePatch(jsonResponse({ ...rated, rating: 4 }));
      await flushAsync();
      expect(within(dialog).getByRole("group", { name: "Rating" })).not.toHaveAttribute("aria-busy");
      expect(onSaved).toHaveBeenCalledOnce();

      await user.click(within(dialog).getByRole("button", { name: "Paused" }));
      expect(within(dialog).getByRole("group", { name: "Rating" })).toHaveAttribute("aria-busy", "true");
      resolvePatch(jsonResponse({ ...rated, progress: "paused" }));
      await flushAsync();
      expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(2);
    });

    it("sends one PATCH for an arrow-key change and ignores further arrows while pending, keeping focus", async () => {
      const user = userEvent.setup();
      let resolvePatch!: (response: Response) => void;
      const calls = mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": () =>
          new Promise<Response>((resolve) => {
            resolvePatch = resolve;
          }),
      });
      renderWithProviders(
        <GameDetailDialog
          game={{ ...rated, rating: 3 }}
          onClose={() => {}}
          onSaved={() => {}}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");
      const group = within(dialog).getByRole("group", { name: "Rating" });
      // eslint-disable-next-line testing-library/no-node-access -- focus check, no query alternative
      const focused = () => document.activeElement;

      act(() => within(dialog).getByRole("radio", { name: "3 Stars" }).focus());
      await user.keyboard("{ArrowRight}");
      expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
      expect(group).toHaveAttribute("aria-busy", "true");
      expect(within(group).getAllByRole("radio")).toContain(focused());

      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
      expect(within(group).getAllByRole("radio")).toContain(focused());

      resolvePatch(jsonResponse({ ...rated, rating: 3.25 }));
      await flushAsync();
    });

    it("only changes the draft in edit mode and sends nothing before Save", async () => {
      const user = userEvent.setup();
      const calls = mockApi(noExpansions);
      renderWithProviders(
        <GameDetailDialog
          game={rated}
          onClose={() => {}}
          onSaved={() => {}}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Edit" }));

      fireEvent.click(within(dialog).getByRole("radio", { name: "2 Stars" }), { clientX: 1, clientY: 1 });

      expect(within(dialog).getByText("2")).toBeInTheDocument();
      expect(calls.filter((c) => c.method === "PATCH")).toEqual([]);
    });
  });

  describe("quick progress toggle", () => {
    const paused: GameResponse = { ...game, progress: "paused" };

    it("PATCHes only the progress on click and stays in view mode", async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      const calls = mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": (call) => jsonResponse({ ...paused, ...(call.body as object) }),
      });
      renderWithProviders(
        <GameDetailDialog
          game={paused}
          onClose={() => {}}
          onSaved={onSaved}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");

      await user.click(within(dialog).getByRole("button", { name: "Playing" }));
      await flushAsync();

      expect(calls.filter((c) => c.method === "PATCH")).toEqual([
        { method: "PATCH", url: "/api/games/id-1", body: { progress: "playing" } },
      ]);
      expect(onSaved).toHaveBeenCalledOnce();
      expect(onSaved.mock.calls[0][0]).toMatchObject({ progress: "playing" });
      expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("shows the error and reverts the pressed button on a failed save", async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": () => jsonResponse({ error: "validation_error", message: "progress: nope" }, 400),
      });
      renderWithProviders(
        <GameDetailDialog
          game={paused}
          onClose={() => {}}
          onSaved={onSaved}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");

      await user.click(within(dialog).getByRole("button", { name: "Playing" }));
      await flushAsync();

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("progress: nope");
      expect(onSaved).not.toHaveBeenCalled();
      expect(within(dialog).getByRole("button", { name: "Paused" })).toHaveAttribute("aria-pressed", "true");
      expect(within(dialog).getByRole("button", { name: "Playing" })).toHaveAttribute("aria-pressed", "false");
    });

    it("blocks further changes and actions while the progress save is pending", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const onSaved = vi.fn();
      let resolvePatch!: (response: Response) => void;
      const calls = mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": () =>
          new Promise<Response>((resolve) => {
            resolvePatch = resolve;
          }),
      });
      renderWithProviders(
        <GameDetailDialog
          game={paused}
          onClose={() => {}}
          onSaved={onSaved}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");

      await user.click(within(dialog).getByRole("button", { name: "Playing" }));

      expect(within(dialog).getByRole("button", { name: "Playing" })).toHaveAttribute("aria-pressed", "true");
      expect(within(dialog).getByRole("group", { name: "Progress" })).toHaveAttribute("aria-busy", "true");
      await user.click(within(dialog).getByRole("button", { name: "Finished" }));
      expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
      expect(within(dialog).getByRole("button", { name: "Edit" })).toBeDisabled();
      expect(within(dialog).getByRole("button", { name: "Delete" })).toBeDisabled();

      resolvePatch(jsonResponse({ ...paused, progress: "playing" }));
      await flushAsync();

      expect(within(dialog).getByRole("group", { name: "Progress" })).not.toHaveAttribute("aria-busy");
      expect(onSaved).toHaveBeenCalledOnce();
    });

    it("only updates the draft in edit mode and sends nothing before Save", async () => {
      const user = userEvent.setup();
      const calls = mockApi(noExpansions);
      renderWithProviders(
        <GameDetailDialog
          game={paused}
          onClose={() => {}}
          onSaved={() => {}}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Edit" }));

      const group = within(dialog).getByRole("group", { name: "Progress" });
      expect(within(group).getByRole("button", { name: "Paused" })).toHaveAttribute("aria-pressed", "true");
      await user.click(within(group).getByRole("button", { name: "Playing" }));

      expect(within(group).getByRole("button", { name: "Playing" })).toHaveAttribute("aria-pressed", "true");
      expect(within(dialog).queryByRole("combobox", { name: "Progress" })).not.toBeInTheDocument();
      expect(calls.filter((c) => c.method === "PATCH")).toEqual([]);
    });
  });

  describe("quick ownership toggle", () => {
    const watchlisted: GameResponse = { ...game, ownership: "watchlist" };
    const ownedButton = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: "Owned" });

    it("PATCHes only the ownership on click and stays in view mode", async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      const calls = mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": (call) => jsonResponse({ ...watchlisted, ...(call.body as object) }),
      });
      renderWithProviders(
        <GameDetailDialog
          game={watchlisted}
          onClose={() => {}}
          onSaved={onSaved}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");
      expect(ownedButton(dialog)).toHaveAttribute("aria-pressed", "false");

      await user.click(ownedButton(dialog));
      await flushAsync();

      expect(calls.filter((c) => c.method === "PATCH")).toEqual([
        { method: "PATCH", url: "/api/games/id-1", body: { ownership: "owned" } },
      ]);
      expect(onSaved).toHaveBeenCalledOnce();
      expect(onSaved.mock.calls[0][0]).toMatchObject({ ownership: "owned" });
      expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("PATCHes subscription when Subscription is chosen", async () => {
      const user = userEvent.setup();
      const calls = mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": (call) => jsonResponse({ ...watchlisted, ...(call.body as object) }),
      });
      renderWithProviders(
        <GameDetailDialog
          game={watchlisted}
          onClose={() => {}}
          onSaved={() => {}}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");

      await user.click(within(dialog).getByRole("button", { name: "Subscription" }));
      await flushAsync();

      expect(calls.filter((c) => c.method === "PATCH")).toEqual([
        { method: "PATCH", url: "/api/games/id-1", body: { ownership: "subscription" } },
      ]);
    });

    it("shows the error and reverts the toggle on a failed save", async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": () => jsonResponse({ error: "validation_error", message: "ownership: nope" }, 400),
      });
      renderWithProviders(
        <GameDetailDialog
          game={watchlisted}
          onClose={() => {}}
          onSaved={onSaved}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");

      await user.click(ownedButton(dialog));
      await flushAsync();

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("ownership: nope");
      expect(onSaved).not.toHaveBeenCalled();
      expect(ownedButton(dialog)).toHaveAttribute("aria-pressed", "false");
    });

    it("is blocked while any quick save is pending", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      let resolvePatch!: (response: Response) => void;
      const calls = mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": () =>
          new Promise<Response>((resolve) => {
            resolvePatch = resolve;
          }),
      });
      renderWithProviders(
        <GameDetailDialog
          game={watchlisted}
          onClose={() => {}}
          onSaved={() => {}}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");
      const ownershipGroup = within(dialog).getByRole("group", { name: "Ownership" });

      // A pending progress save blocks the toggle.
      await user.click(within(dialog).getByRole("button", { name: "Finished" }));
      expect(ownershipGroup).toHaveAttribute("aria-busy", "true");
      await user.click(ownedButton(dialog));
      expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
      resolvePatch(jsonResponse({ ...watchlisted, progress: "finished" }));
      await flushAsync();
      expect(ownershipGroup).not.toHaveAttribute("aria-busy");

      // A pending ownership save blocks a second change and the other controls.
      await user.click(ownedButton(dialog));
      expect(ownedButton(dialog)).toHaveAttribute("aria-pressed", "true");
      expect(ownershipGroup).toHaveAttribute("aria-busy", "true");
      await user.click(within(dialog).getByRole("button", { name: "Subscription" }));
      await user.click(within(dialog).getByRole("button", { name: "Paused" }));
      expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(2);
      resolvePatch(jsonResponse({ ...watchlisted, ownership: "owned" }));
      await flushAsync();
      expect(ownershipGroup).not.toHaveAttribute("aria-busy");
    });

    it("only changes the draft in edit mode and Save sends the ownership", async () => {
      const user = userEvent.setup();
      const calls = mockApi({
        ...noExpansions,
        "PATCH /api/games/:id": (call) => jsonResponse({ ...watchlisted, ...(call.body as object) }),
      });
      renderWithProviders(
        <GameDetailDialog
          game={watchlisted}
          onClose={() => {}}
          onSaved={() => {}}
          onDeleted={() => {}}
          platforms={platforms}
        />,
      );
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Edit" }));

      expect(ownedButton(dialog)).toHaveAttribute("aria-pressed", "false");
      await user.click(ownedButton(dialog));

      expect(ownedButton(dialog)).toHaveAttribute("aria-pressed", "true");
      expect(within(dialog).queryByRole("combobox", { name: "Ownership" })).not.toBeInTheDocument();
      expect(calls.filter((c) => c.method === "PATCH")).toEqual([]);

      await user.click(within(dialog).getByRole("button", { name: "Save" }));
      await flushAsync();
      expect(calls.filter((c) => c.method === "PATCH")).toEqual([
        { method: "PATCH", url: "/api/games/id-1", body: { ownership: "owned" } },
      ]);
    });
  });
});
