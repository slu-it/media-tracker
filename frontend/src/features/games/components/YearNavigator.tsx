import { IconButton, MenuItem, Stack, TextField } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useTranslation } from "react-i18next";

interface YearNavigatorProps {
  /** Selectable years, descending; the navigator has no opinion on how they were derived (see `rankingYears`). */
  years: number[];
  value: number;
  onChange: (year: number) => void;
  /**
   * Accessible name for this instance's wrapping `role="group"`: the ranking page renders two identical copies
   * (above and below the grid), and without a distinct label each control (e.g. "Previous year") would be
   * ambiguous between the two to assistive tech.
   */
  ariaLabel: string;
}

/**
 * Older/newer step buttons around a single-select year dropdown. Left is "older" (back in time, towards the end
 * of the descending `years`), right is "newer"; both are disabled once `value` is at the respective end (or, as a
 * safety net, once `value` is not in `years` at all - the caller derives `value` from `years` so that should not
 * normally happen).
 */
export function YearNavigator({ years, value, onChange, ariaLabel }: YearNavigatorProps) {
  const { t } = useTranslation();
  const index = years.indexOf(value);
  const olderYear = index !== -1 && index < years.length - 1 ? years[index + 1] : undefined;
  const newerYear = index > 0 ? years[index - 1] : undefined;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }} role="group" aria-label={ariaLabel}>
      <IconButton
        aria-label={t("games.ranking.older")}
        disabled={olderYear === undefined}
        onClick={() => olderYear !== undefined && onChange(olderYear)}
      >
        <ChevronLeftIcon />
      </IconButton>
      <TextField
        select
        size="small"
        label={t("games.ranking.year")}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        sx={{ minWidth: 100 }}
      >
        {years.map((year) => (
          <MenuItem key={year} value={year}>
            {year}
          </MenuItem>
        ))}
      </TextField>
      <IconButton
        aria-label={t("games.ranking.newer")}
        disabled={newerYear === undefined}
        onClick={() => newerYear !== undefined && onChange(newerYear)}
      >
        <ChevronRightIcon />
      </IconButton>
    </Stack>
  );
}
