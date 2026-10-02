import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_MEDIA_KIND, MEDIA_KINDS, MEDIA_SUB_PAGES } from "./components/layout/mediaKinds";
import {
  MEDIA_TAB_STORAGE_KEY,
  SUB_PAGE_STORAGE_KEYS,
  allRoutes,
  parseRoute,
  pathFor,
  rememberRoute,
  storedKind,
  storedPathFor,
  storedStartPath,
  storedSubPage,
} from "./routes";

describe("routes", () => {
  beforeEach(() => localStorage.clear());

  it("builds paths for kinds with and without sub-pages", () => {
    expect(pathFor("books")).toBe(`/${MEDIA_KINDS[0]}`);
    expect(pathFor("games", MEDIA_SUB_PAGES.games[1])).toBe(`/games/${MEDIA_SUB_PAGES.games[1]}`);
  });

  it("lists one route per kind without sub-pages and one per sub-page otherwise", () => {
    const expected = MEDIA_KINDS.reduce((sum, kind) => sum + (kind === "games" ? MEDIA_SUB_PAGES.games.length : 1), 0);
    expect(allRoutes()).toHaveLength(expected);
  });

  it("parses every generated path back to its route", () => {
    for (const route of allRoutes()) {
      expect(parseRoute(pathFor(route.kind, route.subPage))).toEqual(route);
    }
    expect(parseRoute(`${pathFor("books")}/`)).toEqual({ kind: "books" });
  });

  it.each(["/", "/nope", "/books/x", "/games", "/games/nope", "/games/overview/x"])("rejects %s", (path) => {
    expect(parseRoute(path)).toBeUndefined();
  });

  it("falls back to the defaults without stored values", () => {
    expect(storedKind()).toBe(DEFAULT_MEDIA_KIND);
    expect(storedSubPage("games")).toBe(MEDIA_SUB_PAGES.games[0]);
    expect(storedSubPage("books")).toBeUndefined();
    expect(storedStartPath()).toBe(pathFor(DEFAULT_MEDIA_KIND));
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem(MEDIA_TAB_STORAGE_KEY, "bogus");
    localStorage.setItem(SUB_PAGE_STORAGE_KEYS.games, "bogus");
    expect(storedKind()).toBe(DEFAULT_MEDIA_KIND);
    expect(storedSubPage("games")).toBe(MEDIA_SUB_PAGES.games[0]);
  });

  it("remembers a route and uses it for the redirects", () => {
    rememberRoute({ kind: "games", subPage: MEDIA_SUB_PAGES.games[2] });
    expect(localStorage.getItem(MEDIA_TAB_STORAGE_KEY)).toBe("games");
    expect(localStorage.getItem(SUB_PAGE_STORAGE_KEYS.games)).toBe(MEDIA_SUB_PAGES.games[2]);
    expect(storedStartPath()).toBe(pathFor("games", MEDIA_SUB_PAGES.games[2]));
    expect(storedPathFor("games")).toBe(pathFor("games", MEDIA_SUB_PAGES.games[2]));
  });

  it("leaves the sub-page key alone when remembering a kind without sub-pages", () => {
    rememberRoute({ kind: "movies" });
    expect(localStorage.getItem(MEDIA_TAB_STORAGE_KEY)).toBe("movies");
    expect(localStorage.getItem(SUB_PAGE_STORAGE_KEYS.games)).toBeNull();
  });
});
