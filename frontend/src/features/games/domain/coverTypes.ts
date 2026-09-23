/*
 * Frontend mirror of the backend `CoverType` enum (games/domain/CoverSource.kt). The value is always chosen from
 * a fixed toggle (static/animated), so there is no validator here.
 *
 * The `CoverType` union type itself lives in `types/api.ts` (the wire-contract mirror); re-exported here so
 * feature code can keep importing it from this module, the same convention as `gameStatus.ts`.
 */

import type { CoverType } from "../../../types/api";

export type { CoverType };

/** Display order for the cover-type toggle. */
export const COVER_TYPES = ["static", "animated"] as const satisfies readonly CoverType[];

// Exhaustiveness guard: `satisfies` above only catches an *extra* array entry that isn't a valid `CoverType`. This
// catches the opposite mistake - a union member missing from the array - by resolving to `never` (fine) unless
// something is left over, in which case the type itself is the leftover value and use as a type errors. The `void`
// cast keeps ESLint's no-unused-vars from flagging an otherwise-unused type alias.
type CoverTypesCoverAllVariants = Exclude<CoverType, (typeof COVER_TYPES)[number]> extends never ? true : never;
void (true satisfies CoverTypesCoverAllVariants);

export const DEFAULT_COVER_TYPE: CoverType = "static";
