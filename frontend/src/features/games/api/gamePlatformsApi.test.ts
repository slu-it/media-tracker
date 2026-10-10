import { describe, expect, it } from "vitest";
import { jsonResponse, mockApi, noContent } from "../../../test/mockFetch";
import { createGamePlatform, deleteGamePlatform, listGamePlatformSummaries, updateGamePlatform } from "./gamesApi";

describe("game platform configuration api", () => {
  it("lists the summaries and maps gameCount to count", async () => {
    const calls = mockApi({
      "GET /api/game-platforms.summaries": () =>
        jsonResponse([{ id: "p1", label: "PC", associatedColor: "757575", gameCount: 2 }]),
    });
    expect(await listGamePlatformSummaries()).toEqual([{ id: "p1", label: "PC", associatedColor: "757575", count: 2 }]);
    expect(calls).toEqual([{ method: "GET", url: "/api/game-platforms.summaries", body: undefined }]);
  });

  it("creates, updates and deletes a platform", async () => {
    const entry = { id: "p1", label: "PC", associatedColor: "757575" };
    const calls = mockApi({
      "POST /api/game-platforms": () => jsonResponse(entry, 201),
      "PATCH /api/game-platforms/:id": () => jsonResponse(entry),
      "DELETE /api/game-platforms/:id": () => noContent(),
    });
    expect(await createGamePlatform("PC", "757575")).toEqual(entry);
    expect(await updateGamePlatform("p 1", { associatedColor: "E60012" })).toEqual(entry);
    await deleteGamePlatform("p 1");
    expect(calls).toEqual([
      { method: "POST", url: "/api/game-platforms", body: { label: "PC", associatedColor: "757575" } },
      { method: "PATCH", url: "/api/game-platforms/p%201", body: { associatedColor: "E60012" } },
      { method: "DELETE", url: "/api/game-platforms/p%201", body: undefined },
    ]);
  });
});
