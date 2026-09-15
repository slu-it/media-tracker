import { describe, expect, it } from "vitest";
import en from "./en.json";
import de from "./de.json";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe("translation bundles", () => {
  it("have identical key sets", () => {
    expect(flattenKeys(de).sort()).toEqual(flattenKeys(en).sort());
  });

  it("have no empty strings", () => {
    for (const bundle of [en, de]) {
      const empty = flattenKeys(bundle).filter(
        (key) => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], bundle) === "",
      );
      expect(empty).toEqual([]);
    }
  });
});
