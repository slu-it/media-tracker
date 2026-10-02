import { DEFAULT_MEDIA_KIND, MEDIA_KINDS, MEDIA_SUB_PAGES, type MediaKind } from "./components/layout/mediaKinds";

/** localStorage key of the last visited media kind. Only read for redirects; the current route writes it. */
export const MEDIA_TAB_STORAGE_KEY = "mt.mediaTab";

/** localStorage key of the last visited sub-page, per media kind that has sub-pages. */
export const SUB_PAGE_STORAGE_KEYS = { games: "mt.gamesPage" } as const satisfies Record<
  keyof typeof MEDIA_SUB_PAGES,
  string
>;

export const ROOT_PATH = "/";

export interface ActiveRoute {
  kind: MediaKind;
  /** Set only for kinds with sub-pages. */
  subPage?: string;
}

/** The sub-pages of a kind in tab order, or an empty list for kinds without sub-pages. */
export function subPagesOf(kind: MediaKind): readonly string[] {
  return (MEDIA_SUB_PAGES as Partial<Record<MediaKind, readonly string[]>>)[kind] ?? [];
}

/** `/{kind}` for kinds without sub-pages, `/{kind}/{subPage}` for kinds with them. */
export function pathFor(kind: MediaKind, subPage?: string): string {
  return subPage === undefined ? `/${kind}` : `/${kind}/${subPage}`;
}

/** Every concrete route as a `{ kind, subPage? }` pair, in tab order. */
export function allRoutes(): ActiveRoute[] {
  return MEDIA_KINDS.flatMap((kind) => {
    const subPages = subPagesOf(kind);
    return subPages.length === 0 ? [{ kind }] : subPages.map((subPage) => ({ kind, subPage }));
  });
}

/** The route a pathname denotes, or `undefined` for anything that is not exactly one of `allRoutes()`. */
export function parseRoute(pathname: string): ActiveRoute | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return allRoutes().find((route) => pathFor(route.kind, route.subPage) === normalized);
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the route still works for this session.
  }
}

/** The last-used kind, `DEFAULT_MEDIA_KIND` when nothing valid is stored. */
export function storedKind(): MediaKind {
  const raw = readStored(MEDIA_TAB_STORAGE_KEY);
  return MEDIA_KINDS.find((kind) => kind === raw) ?? DEFAULT_MEDIA_KIND;
}

/** The last-used sub-page of a kind (its first one when nothing valid is stored); `undefined` without sub-pages. */
export function storedSubPage(kind: MediaKind): string | undefined {
  const subPages = subPagesOf(kind);
  if (subPages.length === 0) return undefined;
  const raw = readStored(SUB_PAGE_STORAGE_KEYS[kind as keyof typeof SUB_PAGE_STORAGE_KEYS]);
  return subPages.find((subPage) => subPage === raw) ?? subPages[0];
}

/** The path a kind's tab leads to: its last-used sub-page if it has sub-pages. */
export function storedPathFor(kind: MediaKind): string {
  return pathFor(kind, storedSubPage(kind));
}

/** Where `/` redirects to. */
export function storedStartPath(): string {
  return storedPathFor(storedKind());
}

/** Remembers the current route for the next visit. */
export function rememberRoute({ kind, subPage }: ActiveRoute): void {
  writeStored(MEDIA_TAB_STORAGE_KEY, kind);
  if (subPage !== undefined) writeStored(SUB_PAGE_STORAGE_KEYS[kind as keyof typeof SUB_PAGE_STORAGE_KEYS], subPage);
}
