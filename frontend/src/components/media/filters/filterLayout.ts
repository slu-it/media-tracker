/** Width of the standard (underline) filter selects of the results row: fits "Release year" and a few chips or values. */
export const FILTER_SELECT_WIDTH = 200;

/** Smallest width of a select below `sm`. */
const FILTER_SELECT_MIN_WIDTH_XS = 160;

/** Below `sm` a select is at least `FILTER_SELECT_MIN_WIDTH_XS` wide (it wraps in a wrapping row otherwise) and grows to share the line; from `sm` each is `FILTER_SELECT_WIDTH` wide. */
export const FILTER_SELECT_SX = {
  flex: { xs: "1 1 0", sm: "none" },
  minWidth: { xs: FILTER_SELECT_MIN_WIDTH_XS, sm: 0 },
  width: { xs: "auto", sm: FILTER_SELECT_WIDTH },
} as const;
