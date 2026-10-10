import { describe, expect, it } from "vitest";
import { sortGroups } from "./groupSort";

const groups = [
  { id: "a", name: "Anna", itemCount: 1 },
  { id: "b", name: "Berta", itemCount: 3 },
  { id: "c", name: "Carl", itemCount: 1 },
  { id: "d", name: "Dora", itemCount: 0 },
  { id: "e", name: "Emil", itemCount: 3 },
];

describe("sortGroups", () => {
  it("returns the input order for name", () => {
    expect(sortGroups(groups, "name")).toBe(groups);
    expect(sortGroups(groups, "name").map((g) => g.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("sorts by count descending and keeps the input order among equal counts", () => {
    expect(sortGroups(groups, "volume").map((g) => g.id)).toEqual(["b", "e", "a", "c", "d"]);
  });

  it("does not mutate the input", () => {
    const copy = [...groups];
    sortGroups(groups, "volume");
    expect(groups).toEqual(copy);
  });
});
