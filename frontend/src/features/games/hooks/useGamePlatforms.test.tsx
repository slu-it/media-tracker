import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { useGamePlatforms } from "./useGamePlatforms";

const platform = { id: "platform-pc", label: "PC", associatedColor: "757575" };

describe("useGamePlatforms", () => {
  it("loads the platforms once on mount and again on reload", async () => {
    const calls = mockApi({ "GET /api/game-platforms": () => jsonResponse([platform]) });
    const { result } = renderHook(() => useGamePlatforms("load failed"));
    expect(result.current.platforms).toBeNull();
    await waitFor(() => expect(result.current.platforms).toEqual([platform]));

    act(() => result.current.reload());
    await waitFor(() => expect(calls).toHaveLength(2));
  });

  it("exposes the backend message on failure", async () => {
    mockApi({ "GET /api/game-platforms": () => jsonResponse({ error: "internal_error" }, 500) });
    const { result } = renderHook(() => useGamePlatforms("load failed"));
    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.platforms).toBeNull();
  });
});
