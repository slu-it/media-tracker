import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GamePlatformResponse } from "../../../types/api";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { AddGameDialog } from "./AddGameDialog";

const platforms: GamePlatformResponse[] = [
  { id: "platform-pc", label: "PC", associatedColor: "757575" },
  { id: "platform-playstation", label: "PlayStation", associatedColor: "0070D1" },
];

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

    await user.type(within(dialog).getByRole("textbox", { name: /title/i }), "Hades");
    await user.click(within(dialog).getByRole("combobox", { name: /release year/i }));
    await user.click(screen.getByRole("option", { name: "2020" }));
    await user.click(within(dialog).getByRole("combobox", { name: /platforms/i }));
    await user.click(screen.getByRole("option", { name: "PC" }));
    expect(save).toBeEnabled(); // description, rating and cover are optional

    await user.type(within(dialog).getByRole("textbox", { name: /description/i }), "Roguelike dungeon crawler.");
    await user.type(within(dialog).getByRole("textbox", { name: /cover image url/i }), "https://img.example/h.png");
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
    await user.type(screen.getByRole("textbox", { name: /title/i }), "Draft");

    rerender(<AddGameDialog open={false} onClose={() => {}} onCreated={() => {}} platforms={platforms} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    rerender(<AddGameDialog open onClose={() => {}} onCreated={() => {}} platforms={platforms} />);
    expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("");
  });
});
