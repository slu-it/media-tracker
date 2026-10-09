import dayjs, { type Dayjs } from "dayjs";

/** dayjs format used to display and edit release dates. */
export const RELEASE_DATE_FORMAT = "YYYY-MM-DD";

/** Formats an ISO-8601 `YYYY-MM-DD` release date for display. */
export function formatReleaseDate(iso: string): string {
  return dayjs(iso).format(RELEASE_DATE_FORMAT);
}

/** Days since the epoch of a calendar date; `Date.UTC` has no time zone, so no DST is involved. */
function epochDay(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

function lengthOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * ISO-8601 duration from `today` to a `YYYY-MM-DD` release date, in calendar years, months and days (largest
 * first, zero parts omitted, `P0D` for the same day). Matches `java.time.Period.between(today, release)`, so
 * `today + duration = release` for both signs: future dates are positive (`P2M16D`), past dates carry a leading `-`
 * (`-P5Y5M5D`). Only the local calendar date of `today` counts, no time zone or time of day is involved.
 */
export function releaseDistance(releaseDate: string, today: Dayjs = dayjs()): string {
  const [y2, m2, d2] = releaseDate.split("-").map(Number);
  const y1 = today.year();
  const m1 = today.month() + 1;
  const d1 = today.date();
  let totalMonths = y2 * 12 + m2 - (y1 * 12 + m1);
  let days = d2 - d1;
  if (totalMonths > 0 && days < 0) {
    totalMonths--;
    const startMonths = y1 * 12 + (m1 - 1) + totalMonths;
    const cy = Math.floor(startMonths / 12);
    const cm = (startMonths % 12) + 1;
    const calculated = epochDay(cy, cm, Math.min(d1, lengthOfMonth(cy, cm)));
    days = epochDay(y2, m2, d2) - calculated;
  } else if (totalMonths < 0 && days > 0) {
    totalMonths++;
    days -= lengthOfMonth(y2, m2);
  }
  const years = Math.trunc(totalMonths / 12);
  const months = totalMonths % 12;
  const abs = (n: number) => Math.abs(n);
  const parts = `${years ? `${abs(years)}Y` : ""}${months ? `${abs(months)}M` : ""}${days ? `${abs(days)}D` : ""}`;
  if (!parts) return "P0D";
  return `${totalMonths < 0 || days < 0 ? "-" : ""}P${parts}`;
}
