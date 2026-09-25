import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { jsonResponse, mockApi } from "../../test/mockFetch";
import { renderWithProviders } from "../../test/renderWithProviders";
import { UserSettingsDialog } from "./UserSettingsDialog";

const PRIMARY_KEY = "11111111-1111-1111-1111-111111111111";

describe("UserSettingsDialog", () => {
  it("shows the title, the API Keys tab and both loaded keys", async () => {
    mockApi({ "GET /api/me/api-keys": () => jsonResponse({ primary: PRIMARY_KEY, secondary: null }) });
    const user = userEvent.setup();
    renderWithProviders(<UserSettingsDialog open onClose={() => {}} />);

    expect(screen.getByRole("heading", { level: 2, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "API Keys" })).toBeInTheDocument();
    await screen.findByRole("textbox", { name: "Primary key" });

    const revealPrimary = screen.getByRole("button", { name: "Show Primary key" });
    const revealSecondary = screen.getByRole("button", { name: "Show Secondary key" });
    expect(revealSecondary).toBeDisabled(); // no secondary key yet
    await user.click(revealPrimary);
    expect(screen.getByRole("textbox", { name: "Primary key" })).toHaveValue(PRIMARY_KEY);
    expect(screen.getByRole("textbox", { name: "Secondary key" })).toHaveValue("");
  });

  it("regenerates the secondary key and reloads it into the field", async () => {
    const newSecondaryKey = "22222222-2222-2222-2222-222222222222";
    const calls = mockApi({
      "GET /api/me/api-keys": () => jsonResponse({ primary: PRIMARY_KEY, secondary: null }),
      "POST /api/me/api-keys/:slot": () => jsonResponse({ primary: PRIMARY_KEY, secondary: newSecondaryKey }),
    });
    const user = userEvent.setup();
    renderWithProviders(<UserSettingsDialog open onClose={() => {}} />);
    await screen.findByRole("textbox", { name: "Secondary key" });

    // No confirmation needed: the secondary slot has no key yet.
    await user.click(screen.getByRole("button", { name: "Generate Secondary key" }));
    await waitFor(() =>
      expect(calls).toEqual([
        { method: "GET", url: "/api/me/api-keys", body: undefined },
        { method: "POST", url: "/api/me/api-keys/secondary", body: undefined },
      ]),
    );

    await user.click(screen.getByRole("button", { name: "Show Secondary key" }));
    expect(screen.getByRole("textbox", { name: "Secondary key" })).toHaveValue(newSecondaryKey);
  });

  it("shows an error alert when loading the keys fails", async () => {
    mockApi({ "GET /api/me/api-keys": () => jsonResponse({ error: "internal_error" }, 500) });
    renderWithProviders(<UserSettingsDialog open onClose={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the API keys.");
  });

  it("does not offer to generate a key before a failed load is retried", async () => {
    mockApi({ "GET /api/me/api-keys": () => jsonResponse({ error: "internal_error" }, 500) });
    const user = userEvent.setup();
    renderWithProviders(<UserSettingsDialog open onClose={() => {}} />);
    await screen.findByRole("alert");

    expect(screen.queryByRole("button", { name: /^Generate/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Regenerate/ })).not.toBeInTheDocument();

    mockApi({ "GET /api/me/api-keys": () => jsonResponse({ primary: PRIMARY_KEY, secondary: null }) });
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByRole("textbox", { name: "Primary key" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("switches to the Export / Import tab", async () => {
    mockApi({ "GET /api/me/api-keys": () => jsonResponse({ primary: PRIMARY_KEY, secondary: null }) });
    const user = userEvent.setup();
    renderWithProviders(<UserSettingsDialog open onClose={() => {}} />);
    await screen.findByRole("textbox", { name: "Primary key" });

    await user.click(screen.getByRole("tab", { name: "Export / Import" }));

    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Primary key" })).not.toBeInTheDocument();
  });
});
