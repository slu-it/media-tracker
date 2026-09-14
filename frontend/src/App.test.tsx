import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the signed-in username returned by /api/me", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ username: "stefan" }));

    render(<App />);

    expect(await screen.findByText("stefan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/me", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("shows an error message when the API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "boom" }, 500));

    render(<App />);

    expect(await screen.findByText(/Could not load your profile/)).toBeInTheDocument();
  });
});
