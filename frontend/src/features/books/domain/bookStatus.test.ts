import { describe, expect, it } from "vitest";
import {
  BOOK_OWNERSHIP_VALUES,
  BOOK_PROGRESS_VALUES,
  DEFAULT_BOOK_OWNERSHIP,
  DEFAULT_BOOK_PROGRESS,
} from "./bookStatus";

describe("bookStatus", () => {
  it("lists the values in display order", () => {
    expect(BOOK_OWNERSHIP_VALUES).toEqual(["watchlist", "owned"]);
    expect(BOOK_PROGRESS_VALUES).toEqual(["abandoned", "not_started", "paused", "reading", "finished"]);
  });

  it("defaults to a listed value", () => {
    expect(BOOK_OWNERSHIP_VALUES).toContain(DEFAULT_BOOK_OWNERSHIP);
    expect(BOOK_PROGRESS_VALUES).toContain(DEFAULT_BOOK_PROGRESS);
  });
});
