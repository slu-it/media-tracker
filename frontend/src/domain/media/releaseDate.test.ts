import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { formatReleaseDate, isReleased, releaseDistance } from "./releaseDate";

describe("formatReleaseDate", () => {
  it("formats an ISO date as YYYY-MM-DD", () => {
    expect(formatReleaseDate("2020-03-05")).toBe("2020-03-05");
  });
});

describe("releaseDistance", () => {
  const today = dayjs("2026-10-09");

  it("is positive for a future date", () => {
    expect(releaseDistance("2026-12-25", today)).toBe("P2M16D");
  });

  it("is negative for a past date", () => {
    expect(releaseDistance("2021-05-04", today)).toBe("-P5Y5M5D");
  });

  it("is P0D on the same day", () => {
    expect(releaseDistance("2026-10-09", today)).toBe("P0D");
  });

  it("omits zero parts", () => {
    expect(releaseDistance("2026-10-12", today)).toBe("P3D");
    expect(releaseDistance("2027-10-09", today)).toBe("P1Y");
    expect(releaseDistance("2025-10-09", today)).toBe("-P1Y");
  });

  it("counts calendar months across a month end", () => {
    expect(releaseDistance("2026-03-01", dayjs("2026-01-31"))).toBe("P1M1D");
  });

  it("handles a leap day", () => {
    expect(releaseDistance("2024-02-29", dayjs("2026-10-09"))).toBe("-P2Y7M9D");
    expect(releaseDistance("2025-03-01", dayjs("2024-02-29"))).toBe("P1Y1D");
  });

  it("crosses a year boundary", () => {
    expect(releaseDistance("2027-01-05", dayjs("2026-12-20"))).toBe("P16D");
    expect(releaseDistance("2026-12-20", dayjs("2027-01-05"))).toBe("-P16D");
  });

  it("ignores the time of day of today", () => {
    expect(releaseDistance("2026-10-10", dayjs("2026-10-09T23:59:00"))).toBe("P1D");
    expect(releaseDistance("2026-10-09", dayjs("2026-10-09T23:59:00"))).toBe("P0D");
    expect(releaseDistance("2026-10-08", dayjs("2026-10-09T00:00:00"))).toBe("-P1D");
  });

  it("matches java.time.Period.between when the release is before today within a month", () => {
    const march1 = dayjs("2026-03-01");
    expect(releaseDistance("2026-01-28", march1)).toBe("-P1M4D");
    expect(releaseDistance("2026-01-29", march1)).toBe("-P1M3D");
    expect(releaseDistance("2026-01-30", march1)).toBe("-P1M2D");
    expect(releaseDistance("2026-01-31", march1)).toBe("-P1M1D");
    expect(releaseDistance("2026-02-28", dayjs("2026-03-31"))).toBe("-P1M3D");
  });

  it("clamps the day of month when walking from today", () => {
    expect(releaseDistance("2026-02-28", dayjs("2026-01-31"))).toBe("P28D");
    expect(releaseDistance("2026-01-31", dayjs("2026-02-28"))).toBe("-P28D");
    expect(releaseDistance("2026-09-30", dayjs("2026-01-31"))).toBe("P7M30D");
  });

  it("counts whole calendar days across a DST change, whatever the time zone", () => {
    // 2022-09-11 is 01:00 local in America/Santiago (clocks skipped midnight); dates must not be affected.
    expect(releaseDistance("2022-09-11", dayjs("2022-09-10"))).toBe("P1D");
    expect(releaseDistance("2022-09-10", dayjs("2022-09-11"))).toBe("-P1D");
    expect(releaseDistance("2026-03-29", dayjs("2026-03-28"))).toBe("P1D");
    expect(releaseDistance("2026-10-25", dayjs("2026-10-24"))).toBe("P1D");
  });
});

describe("isReleased", () => {
  const today = dayjs("2026-10-09");

  it("is true for a past date", () => {
    expect(isReleased("2021-05-04", today)).toBe(true);
  });

  it("is true on the same day", () => {
    expect(isReleased("2026-10-09", today)).toBe(true);
  });

  it("ignores the time of day of today", () => {
    expect(isReleased("2026-10-09", dayjs("2026-10-09T23:59:00"))).toBe(true);
    expect(isReleased("2026-10-09", dayjs("2026-10-09T00:00:00"))).toBe(true);
    expect(isReleased("2026-10-08", dayjs("2026-10-09T00:00:00"))).toBe(true);
  });

  it("is false for tomorrow", () => {
    expect(isReleased("2026-10-10", today)).toBe(false);
    expect(isReleased("2026-10-10", dayjs("2026-10-09T23:59:00"))).toBe(false);
  });
});
