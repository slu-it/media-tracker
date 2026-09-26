import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { flushAsync } from "../../../test/flushAsync";
import { jsonResponse, mockApi, noContent } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { formatDateTime, formatSize } from "../domain/cloudBackupFormat";
import { DropboxBackupSection } from "./DropboxBackupSection";

const NOT_AVAILABLE = { available: false, connected: false, connectedAt: null };
const NOT_CONNECTED = { available: true, connected: false, connectedAt: null };
const CONNECTED_AT = "2026-01-15T10:00:00.000Z";
const CONNECTED = { available: true, connected: true, connectedAt: CONNECTED_AT };
const NO_BACKUP = { lastBackup: null };
const AUTHORIZE_URL =
  "https://www.dropbox.com/oauth2/authorize?client_id=abc&response_type=code&token_access_type=offline";

describe("DropboxBackupSection", () => {
  it("shows a loading state while the status request is in flight", async () => {
    let resolveStatus: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveStatus = resolve;
    });
    mockApi({ "GET /api/dropbox": () => pending });
    renderWithProviders(<DropboxBackupSection />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();

    resolveStatus(jsonResponse(NOT_AVAILABLE));
    await flushAsync();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("shows a hint naming the environment variables when Dropbox is not configured", async () => {
    mockApi({ "GET /api/dropbox": () => jsonResponse(NOT_AVAILABLE) });
    renderWithProviders(<DropboxBackupSection />);

    expect(await screen.findByRole("status")).toHaveTextContent("DROPBOX_APP_KEY");
    expect(screen.getByRole("status")).toHaveTextContent("DROPBOX_APP_SECRET");
    expect(screen.queryByRole("link", { name: "Open Dropbox" })).not.toBeInTheDocument();
  });

  it("hides the connected controls when the status says unavailable despite a stored connection", async () => {
    // The backend should never report available:false with connected:true, but the view must not trust that:
    // it gates the connected block on `available` too.
    mockApi({
      "GET /api/dropbox": () => jsonResponse({ available: false, connected: true, connectedAt: CONNECTED_AT }),
    });
    renderWithProviders(<DropboxBackupSection />);

    expect(await screen.findByRole("status")).toHaveTextContent("DROPBOX_APP_KEY");
    expect(screen.queryByRole("button", { name: "Disconnect" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back up to Dropbox now" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Connected since/)).not.toBeInTheDocument();
  });

  it("renders the authorize URL as a link once it has loaded", async () => {
    let resolveAuthorizeUrl: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveAuthorizeUrl = resolve;
    });
    mockApi({
      "GET /api/dropbox": () => jsonResponse(NOT_CONNECTED),
      "GET /api/dropbox/authorize-url": () => pending,
    });
    renderWithProviders(<DropboxBackupSection />);
    await flushAsync();

    // Hidden, not just disabled, while the URL is still loading.
    expect(screen.queryByRole("link", { name: "Open Dropbox" })).not.toBeInTheDocument();

    resolveAuthorizeUrl(jsonResponse({ url: AUTHORIZE_URL }));

    const link = await screen.findByRole("link", { name: "Open Dropbox" });
    expect(link).toHaveAttribute("href", AUTHORIZE_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows an alert when the authorize URL request fails with a 503", async () => {
    mockApi({
      "GET /api/dropbox": () => jsonResponse(NOT_CONNECTED),
      "GET /api/dropbox/authorize-url": () =>
        jsonResponse({ error: "dropbox_unavailable", message: "Dropbox is not connected." }, 503),
    });
    renderWithProviders(<DropboxBackupSection />);
    await flushAsync();

    expect(await screen.findByRole("alert")).toHaveTextContent("Dropbox is not connected.");
    expect(screen.queryByRole("link", { name: "Open Dropbox" })).not.toBeInTheDocument();
  });

  it("disables Connect until the pasted code is valid, then posts it and switches to the connected view", async () => {
    const calls = mockApi({
      "GET /api/dropbox": () => jsonResponse(NOT_CONNECTED),
      "GET /api/dropbox/authorize-url": () => jsonResponse({ url: AUTHORIZE_URL }),
      "POST /api/dropbox/connection": () => jsonResponse(CONNECTED),
      "GET /api/backup/dropbox": () => jsonResponse(NO_BACKUP),
    });
    const user = userEvent.setup();
    renderWithProviders(<DropboxBackupSection />);
    await flushAsync();

    const connectButton = await screen.findByRole("button", { name: "Connect" });
    expect(connectButton).toBeDisabled();

    const codeField = screen.getByRole("textbox", { name: "Authorization code" });
    await user.click(codeField);
    await user.paste("some-authorization-code");
    expect(connectButton).toBeEnabled();

    await user.click(connectButton);

    await waitFor(() =>
      expect(calls.filter((call) => call.method === "POST")).toEqual([
        { method: "POST", url: "/api/dropbox/connection", body: { code: "some-authorization-code" } },
      ]),
    );
    expect(await screen.findByText(`Connected since ${formatDateTime(CONNECTED_AT, "en")}`)).toBeInTheDocument();
    // The code field is cleared and gone once the connected view replaces it.
    expect(screen.queryByRole("textbox", { name: "Authorization code" })).not.toBeInTheDocument();
  });

  it("disconnects after confirmation and shows the not-connected view again", async () => {
    const calls = mockApi({
      "GET /api/dropbox": () => jsonResponse(CONNECTED),
      "GET /api/backup/dropbox": () => jsonResponse(NO_BACKUP),
      "DELETE /api/dropbox/connection": () => noContent(),
      "GET /api/dropbox/authorize-url": () => jsonResponse({ url: AUTHORIZE_URL }),
    });
    const user = userEvent.setup();
    renderWithProviders(<DropboxBackupSection />);
    await flushAsync();

    await user.click(await screen.findByRole("button", { name: "Disconnect" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "No" }));
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(1));
    expect(await screen.findByRole("link", { name: "Open Dropbox" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disconnect" })).not.toBeInTheDocument();
  });

  it("backs up now and updates the last backup", async () => {
    const newBackup = { modifiedAt: "2026-02-01T08:30:00.000Z", sizeBytes: 1_234_567 };
    mockApi({
      "GET /api/dropbox": () => jsonResponse(CONNECTED),
      "GET /api/backup/dropbox": () => jsonResponse(NO_BACKUP),
      "POST /api/backup/dropbox": () => jsonResponse({ lastBackup: newBackup }),
    });
    const user = userEvent.setup();
    renderWithProviders(<DropboxBackupSection />);

    expect(await screen.findByText("No backup yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back up to Dropbox now" }));

    const expected = `Last backup: ${formatDateTime(newBackup.modifiedAt, "en")} · ${formatSize(newBackup.sizeBytes, "en")}`;
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it("shows a translated message when the Dropbox backup fails with a 502", async () => {
    mockApi({
      "GET /api/dropbox": () => jsonResponse(CONNECTED),
      "GET /api/backup/dropbox": () => jsonResponse(NO_BACKUP),
      // The backend never sends a custom message for this one: it is always this fixed, developer-facing text.
      "POST /api/backup/dropbox": () =>
        jsonResponse({ error: "dropbox_error", message: "dropbox is currently unavailable" }, 502),
    });
    const user = userEvent.setup();
    renderWithProviders(<DropboxBackupSection />);
    await screen.findByText("No backup yet");

    await user.click(screen.getByRole("button", { name: "Back up to Dropbox now" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Dropbox is temporarily unavailable. Try again later.");
  });

  it("falls back to the not-connected view after a 503 dropbox_unavailable on backup-now", async () => {
    let statusCalls = 0;
    mockApi({
      "GET /api/dropbox": () => {
        statusCalls += 1;
        return jsonResponse(statusCalls === 1 ? CONNECTED : NOT_CONNECTED);
      },
      "GET /api/dropbox/authorize-url": () => jsonResponse({ url: AUTHORIZE_URL }),
      "GET /api/backup/dropbox": () => jsonResponse(NO_BACKUP),
      // The backend deleted the connection because it was revoked on Dropbox's side.
      "POST /api/backup/dropbox": () =>
        jsonResponse({ error: "dropbox_unavailable", message: "dropbox is not configured" }, 503),
    });
    const user = userEvent.setup();
    renderWithProviders(<DropboxBackupSection />);

    await user.click(await screen.findByRole("button", { name: "Back up to Dropbox now" }));

    expect(await screen.findByRole("link", { name: "Open Dropbox" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back up to Dropbox now" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disconnect" })).not.toBeInTheDocument();
  });

  it("does not reload in a loop when the backup status keeps answering 503 while still connected", async () => {
    let dropboxCalls = 0;
    let backupCalls = 0;
    mockApi({
      "GET /api/dropbox": () => {
        dropboxCalls += 1;
        return jsonResponse(CONNECTED);
      },
      "GET /api/backup/dropbox": () => {
        backupCalls += 1;
        return jsonResponse({ error: "dropbox_unavailable", message: "dropbox is not configured" }, 503);
      },
      "GET /api/dropbox/authorize-url": () => jsonResponse({ url: AUTHORIZE_URL }),
    });
    renderWithProviders(<DropboxBackupSection />);

    expect(
      await screen.findByText(
        "The Dropbox connection was lost, probably because access was revoked in the Dropbox app. Reconnect to keep backups running.",
      ),
    ).toBeInTheDocument();
    await flushAsync();
    await flushAsync();

    expect(dropboxCalls).toBe(2);
    expect(backupCalls).toBe(1);
  });

  it("shows the loading state again on reconnect instead of the previous session's backup", async () => {
    let backupCalls = 0;
    let resolveSecondBackup: (response: Response) => void = () => {};
    const secondBackup = new Promise<Response>((resolve) => {
      resolveSecondBackup = resolve;
    });
    mockApi({
      "GET /api/dropbox": () => jsonResponse(CONNECTED),
      "GET /api/dropbox/authorize-url": () => jsonResponse({ url: AUTHORIZE_URL }),
      "GET /api/backup/dropbox": () => {
        backupCalls += 1;
        return backupCalls === 1
          ? jsonResponse({ lastBackup: { modifiedAt: "2026-01-01T00:00:00.000Z", sizeBytes: 10 } })
          : secondBackup;
      },
      "DELETE /api/dropbox/connection": () => noContent(),
      "POST /api/dropbox/connection": () => jsonResponse(CONNECTED),
    });
    const user = userEvent.setup();
    renderWithProviders(<DropboxBackupSection />);

    const firstBackupText = `Last backup: ${formatDateTime("2026-01-01T00:00:00.000Z", "en")} · ${formatSize(10, "en")}`;
    expect(await screen.findByText(firstBackupText)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    await user.click(await screen.findByRole("button", { name: "Yes" }));
    await screen.findByRole("link", { name: "Open Dropbox" });

    const codeField = screen.getByRole("textbox", { name: "Authorization code" });
    await user.click(codeField);
    await user.paste("some-authorization-code");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText(firstBackupText)).not.toBeInTheDocument();

    resolveSecondBackup(jsonResponse({ lastBackup: { modifiedAt: "2026-02-01T00:00:00.000Z", sizeBytes: 20 } }));
    await flushAsync();

    const secondBackupText = `Last backup: ${formatDateTime("2026-02-01T00:00:00.000Z", "en")} · ${formatSize(20, "en")}`;
    expect(await screen.findByText(secondBackupText)).toBeInTheDocument();
  });
});
