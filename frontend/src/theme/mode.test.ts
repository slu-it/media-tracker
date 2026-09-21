/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODE_STORAGE_KEY } from "./mode";

describe("MODE_STORAGE_KEY", () => {
  it("is the literal the pre-paint script in index.html hard-codes", () => {
    // index.html's inline script cannot import the constant (it runs before any module graph exists), so this
    // test stands in for that import and fails if the two literals drift apart.
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    expect(indexHtml).toContain(MODE_STORAGE_KEY);
  });
});
