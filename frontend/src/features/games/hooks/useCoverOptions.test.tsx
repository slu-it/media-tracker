import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { useCoverOptions } from "./useCoverOptions";

describe("useCoverOptions", () => {
  it("marks the source unavailable on a 503 cover_source_unavailable, without an error message", async () => {
    mockApi({
      "GET /api/games/:id/cover-options": () => jsonResponse({ error: "cover_source_unavailable" }, 503),
    });
    const { result } = renderHook(() => useCoverOptions("id-2", "Hades", null, "load failed"));

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it("exposes the given error text on any other failure, ignoring the server's raw message", async () => {
    mockApi({
      "GET /api/games/:id/cover-options": () =>
        jsonResponse({ error: "internal_error", message: "cover_source is currently unavailable" }, 502),
    });
    const { result } = renderHook(() => useCoverOptions("id-2", "Hades", null, "load failed"));

    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.unavailable).toBe(false);
  });
});
