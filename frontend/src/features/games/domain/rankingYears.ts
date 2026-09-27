/**
 * Years the yearly ranking's `YearNavigator` offers: every year that has any game at all, rated or not
 * (`releaseYears`, from `GameMetaResponse`, is not filtered to rated games) at or before `currentYear`, plus
 * `currentYear` itself always (so the page has somewhere to land even before any game of the current year is
 * rated), deduplicated and sorted newest first. Meta's `releaseYears` can include years after `currentYear` (a
 * future release date already entered), which the ranking page never offers since there is nothing to rank yet.
 */
export function rankingYears(releaseYears: number[], currentYear: number): number[] {
  const years = new Set(releaseYears.filter((year) => year <= currentYear));
  years.add(currentYear);
  return [...years].sort((a, b) => b - a);
}

/**
 * The year the ranking page should actually show once `years` (re)loads, given the previously `selectedYear`:
 * unchanged when still offered; otherwise `currentYear` when that was the previous selection (nothing else makes
 * sense for "now"), otherwise the nearest remaining year - ties broken to the newer one, since a year only
 * disappears from `years` once its last game (rated or not) is deleted or its release year is changed away, and
 * the newer neighbor is more likely to still be actively played than the older one.
 */
export function resolveRankingYear(years: number[], selectedYear: number, currentYear: number): number {
  if (years.includes(selectedYear)) return selectedYear;
  if (selectedYear === currentYear || years.length === 0) return currentYear;
  return years.reduce((nearest, year) => {
    const distance = Math.abs(year - selectedYear);
    const nearestDistance = Math.abs(nearest - selectedYear);
    return distance < nearestDistance || (distance === nearestDistance && year > nearest) ? year : nearest;
  });
}
