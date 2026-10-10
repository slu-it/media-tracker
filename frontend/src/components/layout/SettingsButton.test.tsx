import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataRevisionContext } from "../../hooks/dataRevision";
import { flushAsync } from "../../test/flushAsync";
import { jsonResponse, mockApi, type RouteHandler } from "../../test/mockFetch";
import { renderWithProviders } from "../../test/renderWithProviders";
import { SettingsButton } from "./SettingsButton";

const SUMMARIES = [{ id: "b1", label: "Audiobook", associatedColor: "0070D1", bookCount: 0 }];

async function setup(post: RouteHandler = () => jsonResponse({}, 201)) {
  const calls = mockApi({
    "GET /api/book-types.summaries": () => jsonResponse(SUMMARIES),
    "POST /api/book-types": post,
  });
  const bump = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(
    <DataRevisionContext value={{ revision: 0, bump }}>
      <SettingsButton />
    </DataRevisionContext>,
  );
  await user.click(screen.getByRole("button", { name: "Settings" }));
  await user.click(screen.getByRole("tab", { name: "Books Configuration" }));
  await screen.findByRole("button", { name: "Rename Audiobook" });
  return { bump, user, calls };
}

async function addBookType(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("textbox", { name: "New book type" }));
  await user.paste("Vinyl");
  await user.click(screen.getByRole("button", { name: "Add" }));
}

describe("SettingsButton", () => {
  it("bumps the data revision on close after a change, not before", async () => {
    const { bump, user, calls } = await setup();
    await addBookType(user);
    await waitFor(() => expect(calls.filter((call) => call.method === "GET")).toHaveLength(2));
    await flushAsync();
    expect(bump).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(bump).toHaveBeenCalledOnce();
  });

  it("does not bump when nothing changed", async () => {
    const { bump, user } = await setup();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await flushAsync();
    expect(bump).not.toHaveBeenCalled();
  });

  it("bumps immediately when a change resolves after the dialog closed", async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { bump, user } = await setup(async () => {
      await held;
      return jsonResponse({}, 201);
    });
    await addBookType(user);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(bump).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(bump).toHaveBeenCalledOnce());
  });
});
