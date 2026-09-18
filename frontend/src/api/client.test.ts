import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, errorMessage } from "./client";
import { jsonResponse, mockApi, noContent } from "../test/mockFetch";

const originalLocation = Object.getOwnPropertyDescriptor(window, "location")!;

afterEach(() => {
  Object.defineProperty(window, "location", originalLocation);
});

describe("apiFetch", () => {
  it("resolves undefined for 204 and empty bodies", async () => {
    mockApi({
      "DELETE /api/x": () => noContent(),
      "GET /api/empty": () => new Response("", { status: 200 }),
    });
    await expect(apiFetch<void>("/api/x", { method: "DELETE" })).resolves.toBeUndefined();
    await expect(apiFetch<void>("/api/empty")).resolves.toBeUndefined();
  });

  it("parses JSON bodies and sends the session cookie", async () => {
    const calls = mockApi({ "GET /api/thing": () => jsonResponse({ a: 1 }) });
    await expect(apiFetch<{ a: number }>("/api/thing")).resolves.toEqual({ a: 1 });
    expect(calls).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith("/api/thing", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("throws ApiError with the parsed error body on 4xx/5xx", async () => {
    mockApi({
      "POST /api/thing": () => jsonResponse({ error: "validation_error", message: "title: must not be blank" }, 400),
    });
    const error = await apiFetch("/api/thing", { method: "POST", body: "{}" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.body).toEqual({ error: "validation_error", message: "title: must not be blank" });
    expect(apiError.message).toBe("title: must not be blank");
    expect(errorMessage(apiError, "fallback")).toBe("title: must not be blank");
    expect(errorMessage(new ApiError(500, "x", { error: "internal_error" }), "fallback")).toBe("fallback");
    expect(errorMessage(new Error("boom"), "fallback")).toBe("fallback");
  });

  it("sends the browser to the login page on 401 and never resolves", async () => {
    mockApi({ "GET /api/thing": () => jsonResponse({ error: "unauthorized" }, 401) });
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });

    const promise = apiFetch("/api/thing");
    let settled = false;
    void promise.then(
      () => (settled = true),
      () => (settled = true),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(settled).toBe(false);
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
  });

  it("rejects with the fetch error on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiFetch("/api/x")).rejects.toThrow("Failed to fetch");
  });

  it("uses the response text as message for a non-JSON error body", async () => {
    mockApi({ "GET /api/thing": () => new Response("boom", { status: 502 }) });
    const error = await apiFetch("/api/thing").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(502);
    expect(apiError.message).toBe("boom");
    expect(apiError.body).toBeUndefined();
  });
});
