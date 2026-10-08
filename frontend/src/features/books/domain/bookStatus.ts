/*
 * Frontend mirror of the backend ownership/progress fields (books/domain/BookStatus.kt). The values are always
 * valid (the form only ever offers one of these), so there is no validator here.
 *
 * The `BookOwnership`/`BookProgress` union types themselves live in `types/api.ts` (the wire-contract mirror);
 * re-exported here so feature code can keep importing them from this module.
 */

import type { BookOwnership, BookProgress } from "../../../types/api";

export type { BookOwnership, BookProgress };

/** Display order of the ownership values; mirrors the Kotlin `BookOwnership` enum declaration order. */
export const BOOK_OWNERSHIP_VALUES = ["watchlist", "owned"] as const satisfies readonly BookOwnership[];

/** Display order of the progress values; mirrors the Kotlin `BookProgress` enum declaration order. */
export const BOOK_PROGRESS_VALUES = [
  "abandoned",
  "not_started",
  "paused",
  "reading",
  "finished",
] as const satisfies readonly BookProgress[];

// Exhaustiveness guards: `satisfies` above only catches an *extra* entry; these catch a union member missing
// from the array (see `games/domain/gameStatus.ts`).
type OwnershipValuesCoverAllVariants =
  Exclude<BookOwnership, (typeof BOOK_OWNERSHIP_VALUES)[number]> extends never ? true : never;
void (true satisfies OwnershipValuesCoverAllVariants);

type ProgressValuesCoverAllVariants =
  Exclude<BookProgress, (typeof BOOK_PROGRESS_VALUES)[number]> extends never ? true : never;
void (true satisfies ProgressValuesCoverAllVariants);

export const DEFAULT_BOOK_OWNERSHIP: BookOwnership = "watchlist";
export const DEFAULT_BOOK_PROGRESS: BookProgress = "not_started";
