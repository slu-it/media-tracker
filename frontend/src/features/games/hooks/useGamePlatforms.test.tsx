import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { jsonResponse, mockApi } from "../../../test/mockFetch";
import { pc as platform } from "../../../test/fixtures/games";
import { useGamePlatforms } from "./useGamePlatforms";

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

  it("ignores a stale response from before the reload once the reload's response has arrived", async () => {
    const reloaded = { id: "platform-reload", label: "Reload", associatedColor: "000000" };
    const resolvers: ((response: Response) => void)[] = [];
    mockApi({
      "GET /api/game-platforms": () => new Promise<Response>((resolve) => resolvers.push(resolve)),
    });
    const { result } = renderHook(() => useGamePlatforms("load failed"));
    await waitFor(() => expect(resolvers).toHaveLength(1));

    act(() => result.current.reload());
    await waitFor(() => expect(resolvers).toHaveLength(2));

    // The reload's response arrives first...
    resolvers[1](jsonResponse([reloaded]));
    await waitFor(() => expect(result.current.platforms).toEqual([reloaded]));

    // ...and the stale initial response must not overwrite it once it eventually resolves.
    resolvers[0](jsonResponse([platform]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.platforms).toEqual([reloaded]);
  });
});
