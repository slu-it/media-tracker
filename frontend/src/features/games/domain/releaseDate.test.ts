import { describe, expect, it } from "vitest";
import { browserDateFormat, formatReleaseDate } from "./releaseDate";

describe("browserDateFormat", () => {
  it("uses day.month.year for de-DE", () => {
    expect(browserDateFormat("de-DE")).toBe("DD[.]MM[.]YYYY");
  });

  it("uses month/day/year for en-US", () => {
    expect(browserDateFormat("en-US")).toBe("MM[/]DD[/]YYYY");
  });

  it("falls back to ISO order for a malformed locale tag", () => {
    expect(browserDateFormat("this is not valid!!")).toBe("YYYY-MM-DD");
  });
});

describe("formatReleaseDate", () => {
  it("formats an ISO date in the given locale's format", () => {
    expect(formatReleaseDate("2020-03-05", "de-DE")).toBe("05.03.2020");
    expect(formatReleaseDate("2020-03-05", "en-US")).toBe("03/05/2020");
  });
});
