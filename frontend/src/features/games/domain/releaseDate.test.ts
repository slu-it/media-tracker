import { describe, expect, it } from "vitest";
import { formatReleaseDate } from "./releaseDate";

describe("formatReleaseDate", () => {
  it("formats an ISO date as YYYY-MM-DD", () => {
    expect(formatReleaseDate("2020-03-05")).toBe("2020-03-05");
  });
});
