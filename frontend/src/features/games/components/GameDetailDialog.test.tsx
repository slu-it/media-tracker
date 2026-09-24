import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ExpansionResponse, GameResponse } from "../../../types/api";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi, noContent } from "../../../test/mockFetch";
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

// A 5+ character title edit debounces a title-suggestions request; added only to the tests that actually edit
// the title that far, so elsewhere `mockApi`'s "unmocked request throws" guard stays meaningful (e.g. it would
// catch `ExpansionDialog`'s title field wrongly requesting suggestions too).
const titleSuggestionsEmpty = { "GET /api/games/title-suggestions": () => jsonResponse({ suggestions: [] }) };

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
    // The cover image sits inside a clickable button inside its own fixed-size frame, so the shared parent is
    // two levels up. Verifying that is structural and has no ARIA role/text query equivalent.
    // eslint-disable-next-line testing-library/no-node-access -- structural layout check, no query alternative
    expect(rating.parentElement).toBe(cover.parentElement!.parentElement!.parentElement);
  });

  it("shows the rating under the cover image, in the same column, in edit mode", async () => {
    const user = userEvent.setup();
    mockApi(noExpansions);
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    const cover = within(dialog).getByRole("img", { name: "Cover preview" });
    const rating = within(dialog).getByRole("group", { name: "Rating" });
    // The cover preview is now clickable (opens the cover picker), so it sits inside its own button, one level
    // deeper than before.
    // eslint-disable-next-line testing-library/no-node-access -- structural layout check, no query alternative
    expect(rating.parentElement).toBe(cover.parentElement!.parentElement!.parentElement);
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

  it("shows no ownership icon for an owned, unhidden game", async () => {
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
    expect(within(dialog).queryByRole("img", { name: "Owned" })).not.toBeInTheDocument();
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
    await user.click(within(expansionDialog).getByRole("combobox", { name: "Progress" }));
    await user.click(screen.getByRole("option", { name: "Finished" }));
    await user.click(within(expansionDialog).getByRole("button", { name: "Save" }));

    await within(expansionDialog).findByText("Finished");
    expect(within(expansionDialog).queryByText("Not started")).not.toBeInTheDocument();
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

    await user.click(within(dialog).getByRole("combobox", { name: "Progress" }));
    await user.click(screen.getByRole("option", { name: "Finished" }));

    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1));
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ progress: "finished" });
  });

  it("edits and saves only the changed fields, then returns to view mode", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const calls = mockApi({
      ...noExpansions,
      ...titleSuggestionsEmpty, // the title below is edited to 5+ characters
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
    const calls = mockApi({ ...noExpansions, ...titleSuggestionsEmpty });
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
    const calls = mockApi({ ...noExpansions, ...titleSuggestionsEmpty });
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
});
