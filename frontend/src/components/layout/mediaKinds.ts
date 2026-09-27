/** The media kinds in tab order. Each has a standalone view under src/features/<kind>/. */
export const MEDIA_KINDS = ["books", "games", "movies", "series"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const DEFAULT_MEDIA_KIND: MediaKind = "books";

/** Sub-pages within a media kind, in tab order. Kinds without sub-pages have no entry here. */
export const MEDIA_SUB_PAGES = {
  games: ["overview", "watchlist", "ranking"],
} as const satisfies Partial<Record<MediaKind, readonly string[]>>;

export type GameSubPage = (typeof MEDIA_SUB_PAGES.games)[number];
