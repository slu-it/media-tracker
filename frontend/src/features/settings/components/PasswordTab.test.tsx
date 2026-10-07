import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { jsonResponse, mockApi, noContent } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { PasswordTab } from "./PasswordTab";

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { current, next, confirm }: { current: string; next: string; confirm: string },
) {
  await user.click(screen.getByLabelText(/^Current password/));
  await user.paste(current);
  await user.click(screen.getByLabelText(/^New password/));
  await user.paste(next);
  await user.click(screen.getByLabelText(/^Confirm new password/));
  await user.paste(confirm);
}

describe("PasswordTab", () => {
  it("blocks submit when the confirmation does not match, without calling the API", async () => {
    const calls = mockApi({ "PUT /api/me/password": () => noContent() });
    const user = userEvent.setup();
    renderWithProviders(<PasswordTab />);

    await fillForm(user, { current: "oldpassword", next: "newpassword1", confirm: "newpassword2" });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("blocks submit when the new password is too short, without calling the API", async () => {
    const calls = mockApi({ "PUT /api/me/password": () => noContent() });
    const user = userEvent.setup();
    renderWithProviders(<PasswordTab />);

    await fillForm(user, { current: "oldpassword", next: "short", confirm: "short" });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("At least 8 characters")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("sends the request, clears the fields and shows a success message", async () => {
    const calls = mockApi({ "PUT /api/me/password": () => noContent() });
    const user = userEvent.setup();
    renderWithProviders(<PasswordTab />);

    await fillForm(user, { current: "oldpassword", next: "newpassword1", confirm: "newpassword1" });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() =>
      expect(calls).toEqual([
        {
          method: "PUT",
          url: "/api/me/password",
          body: { currentPassword: "oldpassword", newPassword: "newpassword1" },
        },
      ]),
    );
    expect(await screen.findByText("Your password was changed.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Current password/)).toHaveValue("");
    expect(screen.getByLabelText(/^New password/)).toHaveValue("");
    expect(screen.getByLabelText(/^Confirm new password/)).toHaveValue("");
    // The fields remount untouched: no stale "Required" error from the now-empty fields under the success alert.
    expect(screen.queryByText("Required")).not.toBeInTheDocument();
  });

  it("shows a field error on the current-password field for a wrong_password response", async () => {
    mockApi({ "PUT /api/me/password": () => jsonResponse({ error: "wrong_password" }, 403) });
    const user = userEvent.setup();
    renderWithProviders(<PasswordTab />);

    await fillForm(user, { current: "wrongpassword", next: "newpassword1", confirm: "newpassword1" });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("The current password is incorrect.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the wrong_password field error again once the current password is edited", async () => {
    mockApi({ "PUT /api/me/password": () => jsonResponse({ error: "wrong_password" }, 403) });
    const user = userEvent.setup();
    renderWithProviders(<PasswordTab />);

    await fillForm(user, { current: "wrongpassword", next: "newpassword1", confirm: "newpassword1" });
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await screen.findByText("The current password is incorrect.");

    await user.click(screen.getByLabelText(/^Current password/));
    await user.paste("x");
    expect(screen.queryByText("The current password is incorrect.")).not.toBeInTheDocument();
  });

  it("clears a stale wrong_password field error when a later submit fails differently", async () => {
    let call = 0;
    mockApi({
      "PUT /api/me/password": () => {
        call += 1;
        return call === 1
          ? jsonResponse({ error: "wrong_password" }, 403)
          : jsonResponse({ error: "internal_error", message: "boom" }, 500);
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<PasswordTab />);

    await fillForm(user, { current: "wrongpassword", next: "newpassword1", confirm: "newpassword1" });
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await screen.findByText("The current password is incorrect.");

    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    expect(screen.queryByText("The current password is incorrect.")).not.toBeInTheDocument();
  });

  it("shows an error alert for any other failure", async () => {
    mockApi({ "PUT /api/me/password": () => jsonResponse({ error: "internal_error", message: "boom" }, 500) });
    const user = userEvent.setup();
    renderWithProviders(<PasswordTab />);

    await fillForm(user, { current: "oldpassword", next: "newpassword1", confirm: "newpassword1" });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
