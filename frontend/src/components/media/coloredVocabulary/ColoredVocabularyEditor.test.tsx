import { Dialog } from "@mui/material";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "../../../api/client";
import { COLOR_PALETTE } from "../../../domain/media/colorPalette";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi, noContent, type RouteHandler } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import type { ColoredEntry, ColoredEntryUpdate, ColoredVocabularyLabels } from "./coloredVocabulary";
import { ColoredVocabularyEditor } from "./ColoredVocabularyEditor";

const LABELS: ColoredVocabularyLabels = {
  empty: "Nothing here",
  count: (count) => `${count} items`,
  addLabel: "New entry",
  changeColor: (name) => `Change color of ${name}`,
  newColor: "Choose new color",
  editName: (name) => `Rename ${name}`,
  deleteLabel: (name) => `Delete ${name}`,
  deleteQuestion: (name) => `Really delete ${name}?`,
  deleteInUse: "Still in use",
  loadFailed: "Could not load.",
};

const KINDLE = { id: "k", label: "Kindle", associatedColor: COLOR_PALETTE[0], count: 2 };
const AUDIO = { id: "a", label: "Audiobook", associatedColor: COLOR_PALETTE[1], count: 0 };

const load = () => apiFetch<ColoredEntry[]>("/api/things");
const create = (label: string, associatedColor: string) =>
  apiFetch<unknown>("/api/things", { method: "POST", body: JSON.stringify({ label, associatedColor }) });
const update = (id: string, changes: ColoredEntryUpdate) =>
  apiFetch<unknown>(`/api/things/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
const remove = (id: string) => apiFetch<void>(`/api/things/${id}`, { method: "DELETE" });

function routes(entries: ColoredEntry[], extra: Record<string, RouteHandler> = {}) {
  return { "GET /api/things": () => jsonResponse(entries), ...extra };
}

function renderEditor(onChanged = vi.fn(), onDialogClose = vi.fn()) {
  renderWithProviders(
    <Dialog open onClose={onDialogClose}>
      <ColoredVocabularyEditor
        load={load}
        create={create}
        update={update}
        remove={remove}
        labels={LABELS}
        onChanged={onChanged}
      />
    </Dialog>,
  );
  return { onChanged, onDialogClose };
}

const writes = (calls: { method: string }[]) => calls.filter((call) => call.method !== "GET");

describe("ColoredVocabularyEditor", () => {
  it("lists the entries with their counts", async () => {
    mockApi(routes([AUDIO, KINDLE]));
    renderEditor();
    expect(await screen.findByRole("button", { name: "Rename Audiobook" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Audiobook"),
      expect.stringContaining("Kindle"),
    ]);
    expect(screen.getByText("0 items")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  it("shows the empty text", async () => {
    mockApi(routes([]));
    renderEditor();
    expect(await screen.findByText("Nothing here")).toBeInTheDocument();
  });

  it("shows an error with retry when loading fails", async () => {
    mockApi({ "GET /api/things": () => jsonResponse({ error: "internal_error" }, 500) });
    const user = userEvent.setup();
    renderEditor();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load.");

    mockApi(routes([KINDLE]));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Rename Kindle" })).toBeInTheDocument();
  });

  it("renames inline with Enter, then reloads and reports the change", async () => {
    const calls = mockApi(routes([KINDLE], { "PATCH /api/things/:id": () => jsonResponse({}) }));
    const user = userEvent.setup();
    const { onChanged } = renderEditor();
    await user.click(await screen.findByRole("button", { name: "Rename Kindle" }));
    const field = screen.getByRole("textbox", { name: "Rename Kindle" });
    await user.clear(field);
    await user.paste("  Kobo ");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(writes(calls)).toEqual([{ method: "PATCH", url: "/api/things/k", body: { label: "Kobo" } }]),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    await waitFor(() => expect(calls.filter((call) => call.method === "GET")).toHaveLength(2));
    expect(screen.queryByRole("textbox", { name: "Rename Kindle" })).not.toBeInTheDocument();
  });

  it("sends no request when the trimmed name is unchanged", async () => {
    const calls = mockApi(routes([KINDLE]));
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole("button", { name: "Rename Kindle" }));
    await user.click(screen.getByRole("textbox", { name: "Rename Kindle" }));
    await user.keyboard("{Enter}");
    expect(writes(calls)).toEqual([]);
    expect(screen.queryByRole("textbox", { name: "Rename Kindle" })).not.toBeInTheDocument();
  });

  it("cancels the rename with Escape without a request and keeps the dialog open", async () => {
    const calls = mockApi(routes([KINDLE]));
    const user = userEvent.setup();
    const { onDialogClose } = renderEditor();
    await user.click(await screen.findByRole("button", { name: "Rename Kindle" }));
    await user.paste("X");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: "Rename Kindle" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename Kindle" })).toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
    expect(onDialogClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("cancels the rename on blur", async () => {
    const calls = mockApi(routes([KINDLE]));
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole("button", { name: "Rename Kindle" }));
    await user.paste("X");
    await user.tab();
    expect(screen.queryByRole("textbox", { name: "Rename Kindle" })).not.toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
  });

  it("shows a taken name inline and stays in edit mode", async () => {
    mockApi(
      routes([KINDLE, AUDIO], {
        "PATCH /api/things/:id": () =>
          jsonResponse({ error: "name_taken", existingId: "a", existingName: "Audiobook" }, 409),
      }),
    );
    const user = userEvent.setup();
    const { onChanged } = renderEditor();
    await user.click(await screen.findByRole("button", { name: "Rename Kindle" }));
    await user.clear(screen.getByRole("textbox", { name: "Rename Kindle" }));
    await user.paste("Audiobook");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Name already in use")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rename Kindle" })).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("keeps focus in the field after a taken name, and Escape cancels the edit but not the dialog", async () => {
    mockApi(
      routes([KINDLE, AUDIO], {
        "PATCH /api/things/:id": () =>
          jsonResponse({ error: "name_taken", existingId: "a", existingName: "Audiobook" }, 409),
      }),
    );
    const user = userEvent.setup();
    const { onDialogClose } = renderEditor();
    await user.click(await screen.findByRole("button", { name: "Rename Kindle" }));
    await user.clear(screen.getByRole("textbox", { name: "Rename Kindle" }));
    await user.paste("Audiobook");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Name already in use")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rename Kindle" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: "Rename Kindle" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename Kindle" })).toBeInTheDocument();
    expect(onDialogClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("recolors through the swatch and the palette", async () => {
    const calls = mockApi(routes([KINDLE], { "PATCH /api/things/:id": () => jsonResponse({}) }));
    const user = userEvent.setup();
    const { onChanged } = renderEditor();
    await user.click(await screen.findByRole("button", { name: "Change color of Kindle" }));
    await user.click(screen.getByRole("button", { name: "Red (#E60012)" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(writes(calls)).toEqual([
        { method: "PATCH", url: "/api/things/k", body: { associatedColor: COLOR_PALETTE[3] } },
      ]),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  });

  it("disables delete for an entry in use and explains why", async () => {
    mockApi(routes([KINDLE]));
    const user = userEvent.setup();
    renderEditor();
    expect(await screen.findByRole("button", { name: "Delete Kindle" })).toBeDisabled();
    expect(screen.getByLabelText("Still in use")).toHaveAttribute("tabindex", "0");
    await user.hover(screen.getByLabelText("Still in use"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Still in use");
  });

  it("deletes an unused entry after confirmation", async () => {
    const calls = mockApi(routes([AUDIO], { "DELETE /api/things/:id": () => noContent() }));
    const user = userEvent.setup();
    const { onChanged } = renderEditor();
    await user.click(await screen.findByRole("button", { name: "Delete Audiobook" }));
    const confirm = screen.getByText("Really delete Audiobook?");
    expect(confirm).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(writes(calls)).toEqual([{ method: "DELETE", url: "/api/things/a", body: undefined }]));
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  });

  it("does not delete when the confirmation is cancelled", async () => {
    const calls = mockApi(routes([AUDIO]));
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole("button", { name: "Delete Audiobook" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Really delete Audiobook?")).not.toBeInTheDocument());
    expect(writes(calls)).toEqual([]);
  });

  it("reloads and shows an error when the entry became used meanwhile (409)", async () => {
    const calls = mockApi(
      routes([AUDIO], { "DELETE /api/things/:id": () => jsonResponse({ error: "conflict" }, 409) }),
    );
    const user = userEvent.setup();
    const { onChanged } = renderEditor();
    await user.click(await screen.findByRole("button", { name: "Delete Audiobook" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Deleting failed.");
    await waitFor(() => expect(calls.filter((call) => call.method === "GET")).toHaveLength(2));
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("adds an entry with the first unused palette color and clears the form", async () => {
    const calls = mockApi(routes([KINDLE, AUDIO], { "POST /api/things": () => jsonResponse({}, 201) }));
    const user = userEvent.setup();
    const { onChanged } = renderEditor();
    await screen.findByRole("button", { name: "Rename Kindle" });
    const field = screen.getByRole("textbox", { name: "New entry" });
    await user.click(field);
    await user.paste("  Paperback ");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(writes(calls)).toEqual([
        { method: "POST", url: "/api/things", body: { label: "Paperback", associatedColor: COLOR_PALETTE[2] } },
      ]),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("textbox", { name: "New entry" })).toHaveValue(""));
  });

  it("adds with a color picked through the swatch", async () => {
    const calls = mockApi(routes([], { "POST /api/things": () => jsonResponse({}, 201) }));
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole("button", { name: "Choose new color" }));
    await user.click(screen.getByRole("button", { name: "Teal (#00796B)" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await user.click(screen.getByRole("textbox", { name: "New entry" }));
    await user.paste("Vinyl");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(writes(calls)).toEqual([
        { method: "POST", url: "/api/things", body: { label: "Vinyl", associatedColor: COLOR_PALETTE[5] } },
      ]),
    );
  });

  it("shows a taken name inline when adding", async () => {
    mockApi(
      routes([KINDLE], {
        "POST /api/things": () => jsonResponse({ error: "name_taken", existingId: "k", existingName: "Kindle" }, 409),
      }),
    );
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole("button", { name: "Rename Kindle" });
    await user.click(screen.getByRole("textbox", { name: "New entry" }));
    await user.paste("kindle");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Name already in use")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "New entry" })).toHaveValue("kindle");
    await flushAsync();
  });

  it("does not add an empty name", async () => {
    const calls = mockApi(routes([]));
    const user = userEvent.setup();
    renderEditor();
    await screen.findByText("Nothing here");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(writes(calls)).toEqual([]);
    expect(screen.getByRole("textbox", { name: "New entry" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("shows no error when the empty add field is focused and blurred", async () => {
    mockApi(routes([]));
    const user = userEvent.setup();
    renderEditor();
    await screen.findByText("Nothing here");
    await user.click(screen.getByRole("textbox", { name: "New entry" }));
    await user.tab();
    expect(screen.getByRole("textbox", { name: "New entry" })).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Required")).not.toBeInTheDocument();
  });
});
