/**
 * The one vertical gap shared by the media views' layout: between the header rows (controls, search,
 * results/pagination), from the results row down to the divider below it, from that divider down to the grid,
 * and from the lower divider down to the bottom controls (pagination or year navigator). Theme spacing units
 * (2 = 16px). Kept in one place so the views and `MediaViewHeader` can't drift apart. Empty-state messages
 * (e.g. "No games yet") keep their own larger padding (`py: 6`) instead of this gap; they replace the grid
 * rather than sitting in the regular row rhythm.
 */
export const SECTION_GAP = 2;

/**
 * Width of a header row that stays narrower than the full container from `md` up: the search field and the
 * "half" controls layout (two controls split evenly), so both align to the same centered column. Full width
 * below `md`.
 */
export const HALF_ROW_WIDTH = { xs: "100%", md: "50%" } as const;
