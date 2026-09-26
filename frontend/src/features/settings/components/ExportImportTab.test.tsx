import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { ExportImportTab } from "./ExportImportTab";

const EXPORT_DATA = { game_platforms: [{ id: "1", label: "PC", associated_color: "1e88e5" }], games: [] };

// Every test mounts the full tab, which now includes the Dropbox section; it fetches its status on mount
// regardless of which part of the tab a given test exercises. "Not available" keeps it to that one request.
const DROPBOX_NOT_AVAILABLE = {
  "GET /api/dropbox": () => jsonResponse({ available: false, connected: false, connectedAt: null }),
};

/** Export/import calls only, so assertions below stay unaffected by the Dropbox section's own request. */
function backupCalls(calls: { method: string; url: string; body: unknown }[]) {
  return calls.filter((call) => call.url.startsWith("/api/backup"));
}

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
    const calls = mockApi({ ...DROPBOX_NOT_AVAILABLE, "GET /api/backup/export": () => jsonResponse(EXPORT_DATA) });
    let downloadName: string | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
    });
    const user = userEvent.setup();
    renderWithProviders(<ExportImportTab />);
    await flushAsync(); // settles the Dropbox section's own status fetch

    await user.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() =>
      expect(backupCalls(calls)).toEqual([{ method: "GET", url: "/api/backup/export", body: undefined }]),
    );
    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(await blob.text()).toBe(JSON.stringify(EXPORT_DATA, null, 2));
    expect(downloadName).toMatch(/^media-tracker-export-\d{4}-\d{2}-\d{2}\.json$/);

    await flushAsync(); // the revoke is deferred to the next macrotask
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("shows an alert with the server's message when the export fails", async () => {
    mockApi({
      ...DROPBOX_NOT_AVAILABLE,
      "GET /api/backup/export": () => jsonResponse({ error: "internal_error", message: "boom" }, 500),
    });
    const user = userEvent.setup();
    renderWithProviders(<ExportImportTab />);
    await flushAsync();

    await user.click(screen.getByRole("button", { name: "Export" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("imports a file and shows the per-table counts", async () => {
    const fileText = JSON.stringify({ games: [{ id: "1" }] });
    const calls = mockApi({
      ...DROPBOX_NOT_AVAILABLE,
      "POST /api/backup/import": () => jsonResponse({ tables: { games: { inserted: 1, skipped: 0 } } }),
    });
    const user = userEvent.setup();
    renderWithProviders(<ExportImportTab />);
    await flushAsync();

    const file = new File([fileText], "export.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Import file"), file);

    await waitFor(() =>
      expect(backupCalls(calls)).toEqual([{ method: "POST", url: "/api/backup/import", body: JSON.parse(fileText) }]),
    );
    expect(await screen.findByText("games: 1 inserted, 0 skipped")).toBeInTheDocument();
  });

  it("shows an alert with the server's message when the import fails", async () => {
    mockApi({
      ...DROPBOX_NOT_AVAILABLE,
      "POST /api/backup/import": () => jsonResponse({ error: "validation_error", message: "unknown table: foo" }, 400),
    });
    const user = userEvent.setup();
    renderWithProviders(<ExportImportTab />);
    await flushAsync();

    const file = new File(["{}"], "bad.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Import file"), file);

    expect(await screen.findByRole("alert")).toHaveTextContent("unknown table: foo");
  });
});
