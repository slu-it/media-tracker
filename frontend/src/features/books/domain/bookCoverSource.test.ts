import { describe, expect, it } from "vitest";
import { audible, hardcover } from "../../../test/fixtures/books";
import { AUDIBLE_TYPE_ID, defaultCoverSource } from "./bookCoverSource";

describe("defaultCoverSource", () => {
  it("is book without types and narrators", () => {
    expect(defaultCoverSource({ types: [], narrators: [] })).toBe("book");
    expect(defaultCoverSource({ types: [hardcover], narrators: [] })).toBe("book");
  });

  it("is audiobook for the seeded Audible type id", () => {
    expect(defaultCoverSource({ types: [{ id: AUDIBLE_TYPE_ID, label: "Hörbuch" }], narrators: [] })).toBe("audiobook");
    expect(defaultCoverSource({ types: [audible], narrators: [] })).toBe("audiobook");
  });

  it("is audiobook for a type named Audible, ignoring case and surrounding spaces", () => {
    expect(defaultCoverSource({ types: [{ id: "x", label: "  aUdIbLe " }], narrators: [] })).toBe("audiobook");
  });

  it("is audiobook when narrators are set", () => {
    expect(defaultCoverSource({ types: [hardcover], narrators: [{ name: "Simon Vance" }] })).toBe("audiobook");
  });
});
