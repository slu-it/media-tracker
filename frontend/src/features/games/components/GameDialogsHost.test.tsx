import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GameResponse } from "../../../types/api";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi, noTitleSuggestions } from "../../../test/mockFetch";
import { celeste, pc, platforms, playstation } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GameDialogsHost } from "./GameDialogsHost";

function Harness({ onUpdated }: { onUpdated: (game: GameResponse) => void }) {
  const [selected, setSelected] = useState<GameResponse | null>(celeste);
  return (
    <GameDialogsHost
      selected={selected}
      onSelect={setSelected}
      onCreated={() => {}}
      onUpdated={onUpdated}
      onDeleted={() => {}}
    />
  );
}

describe("GameDialogsHost", () => {
  it("keeps the dialog closed but still updates the list when a save resolves after closing", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    let resolvePatch!: (response: Response) => void;
    mockApi({
      "GET /api/game-platforms": () => jsonResponse(platforms),
      "GET /api/games/:id/expansions": () => jsonResponse([]),
      "PATCH /api/games/:id": () =>
        new Promise<Response>((resolve) => {
          resolvePatch = resolve;
        }),
    });
    renderWithProviders(<Harness onUpdated={onUpdated} />);
    await flushAsync();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finished" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    resolvePatch(jsonResponse({ ...celeste, progress: "finished" }));
    await flushAsync();

    expect(onUpdated).toHaveBeenCalledOnce();
    expect(onUpdated.mock.calls[0][0]).toMatchObject({ id: celeste.id, progress: "finished" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the add dialog with the chosen preset platform preselected and saves without picking one", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/game-platforms": () => jsonResponse(platforms),
      ...noTitleSuggestions("games"),
      "POST /api/games": (call) => jsonResponse({ id: "new-id", ...(call.body as object) }, 201),
    });
    renderWithProviders(
      <GameDialogsHost
        selected={null}
        onSelect={() => {}}
        onCreated={() => {}}
        onUpdated={() => {}}
        onDeleted={() => {}}
        platformCounts={{ [playstation.id]: 5, [pc.id]: 1 }}
      />,
    );
    const fab = screen.getByRole("button", { name: "Add game" });
    await waitFor(() => expect(fab).toBeEnabled());

    await user.hover(fab);
    await waitFor(() => expect(fab).toHaveAttribute("aria-expanded", "true"));
    await user.click(await screen.findByRole("menuitem", { name: "PlayStation" }));
    const dialog = await screen.findByRole("dialog", { name: "Add game" });
    expect(within(dialog).getByText("PlayStation")).toBeInTheDocument();
    expect(within(dialog).queryByText("PC")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("combobox", { name: /title/i }));
    await user.paste("Hades");
    await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "2020" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({ platformIds: [playstation.id] });
  });

  it("opens the add dialog without a preselected platform via the button itself", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/game-platforms": () => jsonResponse(platforms) });
    renderWithProviders(
      <GameDialogsHost
        selected={null}
        onSelect={() => {}}
        onCreated={() => {}}
        onUpdated={() => {}}
        onDeleted={() => {}}
        platformCounts={{ [playstation.id]: 5 }}
      />,
    );
    const fab = screen.getByRole("button", { name: "Add game" });
    await waitFor(() => expect(fab).toBeEnabled());

    await user.click(fab);
    const dialog = await screen.findByRole("dialog", { name: "Add game" });
    expect(within(dialog).queryByText("PlayStation")).not.toBeInTheDocument();
  });

  it("does not reopen the speed dial when the add dialog is cancelled", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/game-platforms": () => jsonResponse(platforms) });
    renderWithProviders(
      <GameDialogsHost
        selected={null}
        onSelect={() => {}}
        onCreated={() => {}}
        onUpdated={() => {}}
        onDeleted={() => {}}
      />,
    );
    const fab = screen.getByRole("button", { name: "Add game" });
    await waitFor(() => expect(fab).toBeEnabled());

    await user.click(fab);
    await screen.findByRole("dialog", { name: "Add game" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await flushAsync();
    expect(fab).toHaveAttribute("aria-expanded", "false");
  });
});
