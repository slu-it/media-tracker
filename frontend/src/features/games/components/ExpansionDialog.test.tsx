import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { jsonResponse, mockApi, noContent } from "../../../test/mockFetch";
import { hades, hadesExpansion1 } from "../../../test/fixtures/games";
import { flushAsync } from "../../../test/flushAsync";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { ExpansionDialog } from "./ExpansionDialog";

describe("ExpansionDialog", () => {
  it("posts the filled draft in add mode and reports the change", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    const onClose = vi.fn();
    const calls = mockApi({
      "POST /api/games/:gameId/expansions": (call) =>
        jsonResponse({ id: "new-id", gameId: hades.id, sequence: 0, ...(call.body as object) }, 201),
    });
    renderWithProviders(
      <ExpansionDialog gameId={hades.id} expansion={null} open onClose={onClose} onChanged={onChanged} />,
    );
    const dialog = screen.getByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.click(title);
    await user.paste("Boon Pack");
    expect(save).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Not started" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(dialog).getByRole("button", { name: "Playing" }));

    await user.click(save);
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(calls).toEqual([
      {
        method: "POST",
        url: `/api/games/${hades.id}/expansions`,
        body: { title: "Boon Pack", ownership: "watchlist", progress: "playing" },
      },
    ]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the expansion's values in view mode", () => {
    renderWithProviders(
      <ExpansionDialog gameId={hades.id} expansion={hadesExpansion1} open onClose={() => {}} onChanged={() => {}} />,
    );
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText("Boon Pack")).toBeInTheDocument();
    expect(within(dialog).getByText("Owned")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Not started" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("saves a progress click in view mode immediately and stays in view mode", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    const calls = mockApi({
      "PATCH /api/games/:gameId/expansions/:id": (call) =>
        jsonResponse({ ...hadesExpansion1, ...(call.body as object) }),
    });
    renderWithProviders(
      <ExpansionDialog gameId={hades.id} expansion={hadesExpansion1} open onClose={() => {}} onChanged={onChanged} />,
    );
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Finished" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());

    expect(calls).toEqual([
      {
        method: "PATCH",
        url: `/api/games/${hades.id}/expansions/${hadesExpansion1.id}`,
        body: { progress: "finished" },
      },
    ]);
    expect(within(dialog).getByRole("button", { name: "Finished" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("button", { name: "Not started" })).toHaveAttribute("aria-pressed", "false");
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("does nothing when the active progress is clicked", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    const calls = mockApi({});
    renderWithProviders(
      <ExpansionDialog gameId={hades.id} expansion={hadesExpansion1} open onClose={() => {}} onChanged={onChanged} />,
    );
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Not started" }));
    await flushAsync();

    expect(calls).toEqual([]);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("shows the error and reverts the progress when the immediate save fails", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    mockApi({
      "PATCH /api/games/:gameId/expansions/:id": () =>
        jsonResponse({ error: "validation_error", message: "progress: nope" }, 400),
    });
    renderWithProviders(
      <ExpansionDialog gameId={hades.id} expansion={hadesExpansion1} open onClose={() => {}} onChanged={onChanged} />,
    );
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Finished" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("progress: nope");
    expect(onChanged).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: "Not started" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("button", { name: "Finished" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the pending progress as busy and blocks a second save while one is in flight", async () => {
    // The busy group has pointer-events: none, so user-event's pointer check must be off to click it.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    let resolve!: (response: Response) => void;
    const calls = mockApi({
      "PATCH /api/games/:gameId/expansions/:id": () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    });
    renderWithProviders(
      <ExpansionDialog gameId={hades.id} expansion={hadesExpansion1} open onClose={() => {}} onChanged={() => {}} />,
    );
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Finished" }));

    const group = within(dialog).getByRole("group", { name: "Progress" });
    expect(group).toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByRole("button", { name: "Finished" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Not started" }));
    expect(calls).toHaveLength(1);

    resolve(jsonResponse({ ...hadesExpansion1, progress: "finished" }));
    await waitFor(() => expect(group).not.toHaveAttribute("aria-busy"));
    expect(calls).toHaveLength(1);
    expect(within(dialog).getByRole("button", { name: "Finished" })).toHaveAttribute("aria-pressed", "true");
  });

  it("edits and saves only the changed fields, then returns to view mode", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    const calls = mockApi({
      "PATCH /api/games/:gameId/expansions/:id": (call) =>
        jsonResponse({ ...hadesExpansion1, ...(call.body as object) }),
    });
    renderWithProviders(
      <ExpansionDialog gameId={hades.id} expansion={hadesExpansion1} open onClose={() => {}} onChanged={onChanged} />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    await user.click(within(dialog).getByRole("button", { name: "Finished" }));
    expect(calls).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(calls).toEqual([
      {
        method: "PATCH",
        url: `/api/games/${hades.id}/expansions/${hadesExpansion1.id}`,
        body: { progress: "finished" },
      },
    ]);
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("asks for confirmation before deleting, then deletes and closes", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    const onClose = vi.fn();
    const calls = mockApi({ "DELETE /api/games/:gameId/expansions/:id": () => noContent() });
    renderWithProviders(
      <ExpansionDialog gameId={hades.id} expansion={hadesExpansion1} open onClose={onClose} onChanged={onChanged} />,
    );
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await screen.findByText("Delete this expansion?");
    // Selects the last-mounted (topmost) portal: the confirm dialog stacked over the expansion dialog.
    await user.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(calls).toEqual([
      { method: "DELETE", url: `/api/games/${hades.id}/expansions/${hadesExpansion1.id}`, body: undefined },
    ]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the save button disabled for an empty title", async () => {
    const user = userEvent.setup();
    mockApi({});
    renderWithProviders(
      <ExpansionDialog gameId={hades.id} expansion={null} open onClose={() => {}} onChanged={() => {}} />,
    );
    const dialog = screen.getByRole("dialog");

    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.click(title);
    await user.paste("x");
    await user.clear(title);

    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows a backend error and stays open when saving fails", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    mockApi({
      "POST /api/games/:gameId/expansions": () =>
        jsonResponse({ error: "validation_error", message: "title: nope" }, 400),
    });
    renderWithProviders(
      <ExpansionDialog gameId={hades.id} expansion={null} open onClose={() => {}} onChanged={onChanged} />,
    );
    const dialog = screen.getByRole("dialog");

    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.click(title);
    await user.paste("Boon Pack");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("title: nope");
    expect(onChanged).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("textbox", { name: /title/i })).toBeInTheDocument();
  });
});
