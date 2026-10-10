/** Preset colors (`RRGGBB`, no `#`) with the i18n key of their name, offered when picking a color. */
export const PALETTE_ENTRIES = [
  { hex: "757575", nameKey: "media.colors.grey" },
  { hex: "0070D1", nameKey: "media.colors.blue" },
  { hex: "107C10", nameKey: "media.colors.green" },
  { hex: "E60012", nameKey: "media.colors.red" },
  { hex: "5D4037", nameKey: "media.colors.brown" },
  { hex: "00796B", nameKey: "media.colors.teal" },
  { hex: "1A73B5", nameKey: "media.colors.steelBlue" },
  { hex: "F7991C", nameKey: "media.colors.orange" },
  { hex: "7B1FA2", nameKey: "media.colors.purple" },
  { hex: "512DA8", nameKey: "media.colors.deepPurple" },
  { hex: "303F9F", nameKey: "media.colors.indigo" },
  { hex: "0097A7", nameKey: "media.colors.cyan" },
  { hex: "689F38", nameKey: "media.colors.oliveGreen" },
  { hex: "FFA000", nameKey: "media.colors.amber" },
  { hex: "E64A19", nameKey: "media.colors.deepOrange" },
  { hex: "C2185B", nameKey: "media.colors.pink" },
] as const;

/** Preset colors (`RRGGBB`, no `#`) offered when picking the color of a platform or book type. */
export const COLOR_PALETTE: readonly string[] = PALETTE_ENTRIES.map((entry) => entry.hex);

/** The first palette color not in `used` (compared case-insensitively); the first one when all are taken. */
export function firstUnusedColor(used: readonly string[]): string {
  const taken = new Set(used.map((color) => color.toUpperCase()));
  return COLOR_PALETTE.find((color) => !taken.has(color)) ?? COLOR_PALETTE[0];
}
