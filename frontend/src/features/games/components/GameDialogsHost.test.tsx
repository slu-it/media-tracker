import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GameResponse } from "../../../types/api";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { celeste, platforms } from "../../../test/fixtures/games";
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
});
