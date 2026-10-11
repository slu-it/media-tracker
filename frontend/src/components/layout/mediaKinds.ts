/** The media kinds in tab order. Each has a standalone view under src/features/<kind>/. */
export const MEDIA_KINDS = ["books", "games", "movies", "series"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const DEFAULT_MEDIA_KIND: MediaKind = "books";

/** Sub-pages within a media kind, in tab order. Kinds without sub-pages have no entry here. */
export const MEDIA_SUB_PAGES = {
  books: ["overview", "watchlist", "authors", "narrators", "series"],
  games: ["overview", "watchlist", "ranking", "developers", "series"],
} as const satisfies Partial<Record<MediaKind, readonly string[]>>;

export type GameSubPage = (typeof MEDIA_SUB_PAGES.games)[number];
export type BookSubPage = (typeof MEDIA_SUB_PAGES.books)[number];
/** Every sub-page name of any kind; also the key set of the shared `subPages.pages.*` labels (`series` is worded per kind, see `App.tsx`). */
export type SubPage = BookSubPage | GameSubPage;
