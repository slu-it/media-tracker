import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { ExportImportTab } from "./ExportImportTab";

const EXPORT_DATA = { game_platforms: [{ id: "1", label: "PC", associated_color: "1e88e5" }], games: [] };

describe("ExportImportTab", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => "blob:mock-url");
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
  });

  it("exports the backup and triggers a download of the JSON", async () => {
    const calls = mockApi({ "GET /api/backup/export": () => jsonResponse(EXPORT_DATA) });
    let downloadName: string | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
    });
    const user = userEvent.setup();
    renderWithProviders(<ExportImportTab />);

    await user.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() => expect(calls).toEqual([{ method: "GET", url: "/api/backup/export", body: undefined }]));
    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(await blob.text()).toBe(JSON.stringify(EXPORT_DATA, null, 2));
    expect(downloadName).toMatch(/^media-tracker-export-\d{4}-\d{2}-\d{2}\.json$/);

    await flushAsync(); // the revoke is deferred to the next macrotask
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("shows an alert with the server's message when the export fails", async () => {
    mockApi({
      "GET /api/backup/export": () => jsonResponse({ error: "internal_error", message: "boom" }, 500),
    });
    const user = userEvent.setup();
    renderWithProviders(<ExportImportTab />);

    await user.click(screen.getByRole("button", { name: "Export" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("imports a file and shows the per-table counts", async () => {
    const fileText = JSON.stringify({ games: [{ id: "1" }] });
    const calls = mockApi({
      "POST /api/backup/import": () => jsonResponse({ tables: { games: { inserted: 1, skipped: 0 } } }),
    });
    const user = userEvent.setup();
    renderWithProviders(<ExportImportTab />);

    const file = new File([fileText], "export.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Import file"), file);

    await waitFor(() =>
      expect(calls).toEqual([{ method: "POST", url: "/api/backup/import", body: JSON.parse(fileText) }]),
    );
    expect(await screen.findByText("games: 1 inserted, 0 skipped")).toBeInTheDocument();
  });

  it("shows an alert with the server's message when the import fails", async () => {
    mockApi({
      "POST /api/backup/import": () => jsonResponse({ error: "validation_error", message: "unknown table: foo" }, 400),
    });
    const user = userEvent.setup();
    renderWithProviders(<ExportImportTab />);

    const file = new File(["{}"], "bad.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Import file"), file);

    expect(await screen.findByRole("alert")).toHaveTextContent("unknown table: foo");
  });
});
