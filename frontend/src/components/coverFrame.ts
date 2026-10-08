/**
 * Default aspect ratio of a cover frame: portrait 22:31, the shape of the 660x930 "grid" image SteamGridDB (and
 * the cover picker built on it) serves as its standard cover size. Games keep it; a kind with another cover shape
 * (books use 2:3) passes its own ratio.
 */
export const COVER_ASPECT_RATIO = 22 / 31;

/** Height a cover frame of the given `width` needs to keep `aspectRatio` (default {@link COVER_ASPECT_RATIO}). */
export function coverHeight(width: number, aspectRatio: number = COVER_ASPECT_RATIO): number {
  return Math.round(width / aspectRatio);
}
