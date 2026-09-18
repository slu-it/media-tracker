import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GamePlatformResponse } from "../../../types/api";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { pc, playstation } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { AddGameDialog } from "./AddGameDialog";

const platforms: GamePlatformResponse[] = [pc, playstation];

describe("AddGameDialog", () => {
  it("posts the filled form and reports the created game", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const calls = mockApi({
      "POST /api/games": (call) => jsonResponse({ id: "new-id", ...(call.body as object) }, 201),
    });
    renderWithProviders(<AddGameDialog open onClose={() => {}} onCreated={onCreated} platforms={platforms} />);
    const dialog = screen.getByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    // user.paste avoids per-keystroke user.type, which is ~10x slower and hit the CI timeout.
    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.click(title);
    await user.paste("Hades");
    await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "2020" }));
    await user.click(within(dialog).getByRole("combobox", { name: /platforms/i }));
    await user.click(screen.getByRole("option", { name: "PC" }));
    expect(save).toBeEnabled(); // description, rating and cover are optional

    const description = within(dialog).getByRole("textbox", { name: /description/i });
    await user.click(description);
    await user.paste("Roguelike dungeon crawler.");
    const coverImageUrl = within(dialog).getByRole("textbox", { name: /cover image url/i });
    await user.click(coverImageUrl);
    await user.paste("https://img.example/h.png");
    expect(within(dialog).getByRole("img", { name: "Cover preview" })).toHaveAttribute(
      "src",
      "https://img.example/h.png",
    );

    await user.click(save);
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(calls).toEqual([
      {
        method: "POST",
        url: "/api/games",
        body: {
          title: "Hades",
          releaseYear: 2020,
          platformIds: ["platform-pc"],
          description: "Roguelike dungeon crawler.",
          rating: null,
          coverImageUrl: "https://img.example/h.png",
        },
      },
    ]);
    expect(onCreated.mock.calls[0][0]).toMatchObject({ id: "new-id", title: "Hades" });
  });

  it("has no delete action and resets when reopened", async () => {
    mockApi({});
    const { rerender } = renderWithProviders(
      <AddGameDialog open onClose={() => {}} onCreated={() => {}} platforms={platforms} />,
    );
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    const user = userEvent.setup();
    const title = screen.getByRole("textbox", { name: /title/i });
    await user.click(title);
    await user.paste("Draft");

    rerender(<AddGameDialog open={false} onClose={() => {}} onCreated={() => {}} platforms={platforms} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    rerender(<AddGameDialog open onClose={() => {}} onCreated={() => {}} platforms={platforms} />);
    expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("");
  });

  it("shows the backend error and stays open when creating fails", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    mockApi({
      "POST /api/games": () => jsonResponse({ error: "validation_error", message: "title: nope" }, 400),
    });
    renderWithProviders(<AddGameDialog open onClose={() => {}} onCreated={onCreated} platforms={platforms} />);
    const dialog = screen.getByRole("dialog");

    const title = within(dialog).getByRole("textbox", { name: /title/i });
    await user.click(title);
    await user.paste("Hades");
    await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "2020" }));
    await user.click(within(dialog).getByRole("combobox", { name: /platforms/i }));
    await user.click(screen.getByRole("option", { name: "PC" }));

    const save = within(dialog).getByRole("button", { name: "Save" });
    await user.click(save);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("title: nope");
    expect(onCreated).not.toHaveBeenCalled();
    expect(save).toBeEnabled();
  });
});
