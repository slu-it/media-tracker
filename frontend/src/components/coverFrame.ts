/**
 * Aspect ratio every cover frame in the app uses: portrait 22:31, the shape of the 660x930 "grid" image
 * SteamGridDB (and the cover picker built on it) serves as its standard cover size.
 */
export const COVER_ASPECT_RATIO = 22 / 31;

/** Height a cover frame of the given `width` needs to keep {@link COVER_ASPECT_RATIO}. */
export function coverHeight(width: number): number {
  return Math.round(width / COVER_ASPECT_RATIO);
}
