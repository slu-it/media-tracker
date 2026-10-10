/** Whether a cover thumbnail URL points at a WebM clip rather than a still image, ignoring case and query string. */
export function isVideoThumbnail(url: string): boolean {
  return url.split("?")[0].toLowerCase().endsWith(".webm");
}
