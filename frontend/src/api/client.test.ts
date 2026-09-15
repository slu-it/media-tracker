import { describe, expect, it } from "vitest";
import { ApiError, apiFetch, errorMessage } from "./client";
import { jsonResponse, mockApi, noContent } from "../test/mockFetch";

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
});
