import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GameResponse } from "../../../types/api";
import { jsonResponse, mockApi, noContent } from "../../../test/mockFetch";
import { celeste, nintendo, pc, platforms } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GameDetailDialog } from "./GameDetailDialog";

const game: GameResponse = {
  ...celeste,
  description: "A tough platformer about climbing a mountain.",
  rating: 4.5,
};

describe("GameDetailDialog", () => {
  it("shows the cover image but not the cover image URL as text in view mode", () => {
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByRole("img", { name: "Celeste" })).toHaveAttribute("src", game.coverImageUrl);
    expect(within(dialog).queryByText(game.coverImageUrl!)).not.toBeInTheDocument();
  });

  it("shows the rating under the cover image, in the same column, in view mode", () => {
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");

    const cover = within(dialog).getByRole("img", { name: "Celeste" });
    const rating = within(dialog).getByRole("group", { name: "Rating" });
    // The cover image sits in its own fixed-size frame, so the shared parent is one level up. Verifying that
    // is structural and has no ARIA role/text query equivalent.
    // eslint-disable-next-line testing-library/no-node-access -- structural layout check, no query alternative
    expect(rating.parentElement).toBe(cover.parentElement!.parentElement);
  });

  it("shows the rating under the cover image, in the same column, in edit mode", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    const cover = within(dialog).getByRole("img", { name: "Cover preview" });
    const rating = within(dialog).getByRole("group", { name: "Rating" });
    // eslint-disable-next-line testing-library/no-node-access -- structural layout check, no query alternative
    expect(rating.parentElement).toBe(cover.parentElement!.parentElement);
  });

  it("shows the description under the title and platform chips in view mode", () => {
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText(game.description!)).toBeInTheDocument();
    expect(within(dialog).getByText("Nintendo")).toBeInTheDocument();
  });

  it("edits and saves only the changed fields, then returns to view mode", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const calls = mockApi({
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

    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.clear(title);
    await user.paste("Celeste (Switch)");
    await user.clear(within(dialog).getByRole("textbox", { name: /cover image url/i }));
    expect(save).toBeEnabled();

    await user.click(save);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(calls).toEqual([
      { method: "PATCH", url: "/api/games/id-1", body: { title: "Celeste (Switch)", coverImageUrl: null } },
    ]);
    expect(onSaved.mock.calls[0][0]).toMatchObject({ title: "Celeste (Switch)", coverImageUrl: null });
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("sends platformIds when the platform selection changes", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
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
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toMatchObject({ platformIds: expect.arrayContaining([nintendo.id, pc.id]) as unknown });
  });

  it("clears the description when emptied", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "PATCH /api/games/:id": (call) => jsonResponse({ ...game, ...(call.body as object) }),
    });
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.clear(within(dialog).getByRole("textbox", { name: /description/i }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ description: null });
  });

  it("keeps the save button disabled while the draft is invalid and shows backend errors", async () => {
    const user = userEvent.setup();
    mockApi({
      "PATCH /api/games/:id": () => jsonResponse({ error: "validation_error", message: "title: nope" }, 400),
    });
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.clear(title);
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();

    await user.type(title, "X");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("title: nope");
    expect(within(dialog).getByRole("textbox", { name: /title/i })).toBeInTheDocument(); // still editing
  });

  it("asks for confirmation before deleting, in view and in edit mode", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const calls = mockApi({ "DELETE /api/games/:id": () => noContent() });
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
    expect(calls).toEqual([]);
    expect(onDeleted).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText('Delete "Celeste"?');
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledExactlyOnceWith("id-1"));
    expect(calls).toEqual([{ method: "DELETE", url: "/api/games/id-1", body: undefined }]);
  });

  it("cancel discards the edits and returns to view mode", async () => {
    const user = userEvent.setup();
    const calls = mockApi({});
    renderWithProviders(
      <GameDetailDialog game={game} onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.clear(title);
    await user.paste("Celeste (changed)");

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Celeste")).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it("closes without saving", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const calls = mockApi({});
    renderWithProviders(
      <GameDetailDialog game={game} onClose={onClose} onSaved={() => {}} onDeleted={() => {}} platforms={platforms} />,
    );
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByRole("textbox", { name: /title/i }), "!");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(calls).toEqual([]);
  });
});
