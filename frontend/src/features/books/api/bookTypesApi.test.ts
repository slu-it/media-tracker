import { describe, expect, it } from "vitest";
import { jsonResponse, mockApi, noContent } from "../../../test/mockFetch";
import { createBookType, deleteBookType, listBookTypeSummaries, updateBookType } from "./booksApi";

describe("book type configuration api", () => {
  it("lists the summaries and maps bookCount to count", async () => {
    const calls = mockApi({
      "GET /api/book-types.summaries": () =>
        jsonResponse([{ id: "b1", label: "Kindle", associatedColor: "0070D1", bookCount: 4 }]),
    });
    expect(await listBookTypeSummaries()).toEqual([{ id: "b1", label: "Kindle", associatedColor: "0070D1", count: 4 }]);
    expect(calls).toEqual([{ method: "GET", url: "/api/book-types.summaries", body: undefined }]);
  });

  it("creates, updates and deletes a book type", async () => {
    const entry = { id: "b1", label: "Kindle", associatedColor: "0070D1" };
    const calls = mockApi({
      "POST /api/book-types": () => jsonResponse(entry, 201),
      "PATCH /api/book-types/:id": () => jsonResponse(entry),
      "DELETE /api/book-types/:id": () => noContent(),
    });
    expect(await createBookType("Kindle", "0070D1")).toEqual(entry);
    expect(await updateBookType("b 1", { label: "Kobo" })).toEqual(entry);
    await deleteBookType("b 1");
    expect(calls).toEqual([
      { method: "POST", url: "/api/book-types", body: { label: "Kindle", associatedColor: "0070D1" } },
      { method: "PATCH", url: "/api/book-types/b%201", body: { label: "Kobo" } },
      { method: "DELETE", url: "/api/book-types/b%201", body: undefined },
    ]);
  });
});
