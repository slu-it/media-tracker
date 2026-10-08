import { describe, expect, it } from "vitest";
import { EMPTY_BOOK_FILTERS } from "./bookFilters";
import { bookOverviewParams, parseBookOverviewParams } from "./bookViewParams";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

const parse = (query: string) => parseBookOverviewParams(new URLSearchParams(query));

describe("book overview params", () => {
  it("parses an empty query to the defaults", () => {
    expect(parse("")).toEqual({ search: "", page: 1, filters: EMPTY_BOOK_FILTERS });
  });

  it("round-trips a full state", () => {
    const state = {
      search: "dune",
      page: 3,
      filters: {
        typeIds: [A, B],
        ownership: ["owned" as const],
        progress: ["finished" as const, "reading" as const],
        releaseYears: [1965, 1968],
      },
    };
    expect(parseBookOverviewParams(bookOverviewParams(state))).toEqual(state);
  });

  it("omits defaults and empty values", () => {
    expect(bookOverviewParams({ search: "  ", page: 1, filters: EMPTY_BOOK_FILTERS }).toString()).toBe("");
  });

  it("serializes in a deterministic key and value order", () => {
    const params = bookOverviewParams({
      search: " dune ",
      page: 2,
      filters: { typeIds: [B, A, B], ownership: ["owned", "watchlist"], progress: [], releaseYears: [1968, 1965] },
    });
    expect(params.toString()).toBe(
      `search=dune&type=${A}&type=${B}&ownership=owned&ownership=watchlist&year=1965&year=1968&page=2`,
    );
    expect(parseBookOverviewParams(params)).toEqual(
      parse(`page=2&year=1968&year=1965&ownership=watchlist&ownership=owned&type=${B}&type=${A}&search=dune`),
    );
  });

  it("drops invalid values silently", () => {
    expect(
      parse("type=nope&ownership=subscription&progress=playing&year=99&year=abc&page=0&search=" + "x".repeat(201)),
    ).toEqual({ search: "", page: 1, filters: EMPTY_BOOK_FILTERS });
  });

  it("lowercases type ids", () => {
    expect(parse(`type=${A.toUpperCase()}`).filters.typeIds).toEqual([A]);
  });
});
