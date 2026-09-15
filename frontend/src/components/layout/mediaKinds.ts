/** The media kinds in tab order. Each has a standalone view under src/features/<kind>/. */
export const MEDIA_KINDS = ["books", "games", "movies", "series"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const DEFAULT_MEDIA_KIND: MediaKind = "books";

export function isMediaKind(value: string): value is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(value);
}
