/*
 * Frontend mirror of the backend ownership/progress/hidden fields (games/domain/GameStatus.kt). The values are
 * always valid (dropdowns only ever offer one of these), so there is no validator here.
 *
 * The `Ownership`/`Progress` union types themselves live in `types/api.ts` (the wire-contract mirror); re-exported
 * here so feature code can keep importing them from this module.
 */

import type { Ownership, Progress } from "../../../types/api";

export type { Ownership, Progress };

/** Display order for the ownership dropdown. */
export const OWNERSHIP_VALUES = ["watchlist", "owned"] as const satisfies readonly Ownership[];

/** Display order for the progress dropdown. */
export const PROGRESS_VALUES = [
  "not_started",
  "playing",
  "finished",
  "completed",
  "paused",
  "abandoned",
] as const satisfies readonly Progress[];

// Exhaustiveness guards: `satisfies` above only catches an *extra* array entry that isn't a valid `Ownership`/
// `Progress`. These two catch the opposite mistake - a union member missing from the array - by resolving to
// `never` (fine) unless something is left over, in which case the type itself is the leftover value and use as
// a type errors. The `void` cast keeps ESLint's no-unused-vars from flagging an otherwise-unused type alias.
type OwnershipValuesCoverAllVariants =
  Exclude<Ownership, (typeof OWNERSHIP_VALUES)[number]> extends never ? true : never;
void (true satisfies OwnershipValuesCoverAllVariants);

type ProgressValuesCoverAllVariants = Exclude<Progress, (typeof PROGRESS_VALUES)[number]> extends never ? true : never;
void (true satisfies ProgressValuesCoverAllVariants);

export const DEFAULT_OWNERSHIP: Ownership = "watchlist";
export const DEFAULT_PROGRESS: Progress = "not_started";
export const DEFAULT_HIDDEN = false;
