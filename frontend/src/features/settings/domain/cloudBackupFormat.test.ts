import { describe, expect, it } from "vitest";
import { formatDateTime, formatSize } from "./cloudBackupFormat";

describe("formatDateTime", () => {
  it("formats an ISO instant in the given language", () => {
    const formatted = formatDateTime("2026-01-15T10:00:00.000Z", "en");
    expect(formatted).toMatch(/2026/);
    expect(formatted).not.toBe(formatDateTime("2026-01-15T10:00:00.000Z", "de"));
  });
});

describe("formatSize", () => {
  it("picks the largest unit at or below the value, with one decimal", () => {
    expect(formatSize(10, "en")).toBe("10 byte");
    expect(formatSize(1_500, "en")).toBe("1.5 kB");
    expect(formatSize(1_234_567, "en")).toBe("1.2 MB");
  });

  it("uses the German decimal separator", () => {
    expect(formatSize(1_234_567, "de")).toBe("1,2 MB");
  });
});
