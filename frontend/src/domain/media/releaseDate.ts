import dayjs from "dayjs";

/** dayjs format used to display and edit release dates. */
export const RELEASE_DATE_FORMAT = "YYYY-MM-DD";

/** Formats an ISO-8601 `YYYY-MM-DD` release date for display. */
export function formatReleaseDate(iso: string): string {
  return dayjs(iso).format(RELEASE_DATE_FORMAT);
}
