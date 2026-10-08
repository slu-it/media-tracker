import { describe, expect, it } from "vitest";
import { withReleaseDate } from "./draft";

describe("draft", () => {
  it("overrides the release year with the release date's year, but leaves it alone when the date is cleared", () => {
    const draft = withReleaseDate(
      { releaseYear: 2018 as number | null, releaseDate: null as string | null },
      "2015-06-20",
    );
    expect(draft.releaseDate).toBe("2015-06-20");
    expect(draft.releaseYear).toBe(2015);

    const cleared = withReleaseDate(draft, null);
    expect(cleared.releaseDate).toBeNull();
    expect(cleared.releaseYear).toBe(2015); // unchanged: the year selector stays editable at its last value
  });
});
