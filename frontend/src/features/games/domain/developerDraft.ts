import type { GameDeveloperResponse } from "../../../types/api";

/**
 * One selected developer chip: either a developer that already exists in the backend's vocabulary, or free-solo
 * text typed by the user that does not (yet) have an id. `GameForm` resolves the pending ones (via
 * `createGameDeveloper`) into `GameDeveloperResponse`s before building the create/update request.
 */
export type DeveloperDraft = GameDeveloperResponse | { name: string };

export function isExistingDeveloper(draft: DeveloperDraft): draft is GameDeveloperResponse {
  return "id" in draft;
}

function normalizedName(draft: DeveloperDraft): string {
  return draft.name.trim().toLowerCase();
}

/**
 * Adds `candidate` to `list`, de-duplicating case-insensitively:
 * - an existing developer (has an `id`) already present by `id` is left as-is;
 * - an existing developer whose name matches a *pending* entry already in the list replaces that pending entry
 *   (a suggestion picked after its free-solo name was already typed upgrades the chip instead of duplicating it);
 * - a pending candidate whose (trimmed) name matches any entry already in the list, existing or pending, is
 *   dropped: it never downgrades an existing developer back to a pending one.
 */
export function addDeveloper(list: DeveloperDraft[], candidate: DeveloperDraft): DeveloperDraft[] {
  if (isExistingDeveloper(candidate)) {
    if (list.some((entry) => isExistingDeveloper(entry) && entry.id === candidate.id)) return list;
    const pendingIndex = list.findIndex(
      (entry) => !isExistingDeveloper(entry) && normalizedName(entry) === normalizedName(candidate),
    );
    if (pendingIndex === -1) return [...list, candidate];
    const next = [...list];
    next[pendingIndex] = candidate;
    return next;
  }
  if (list.some((entry) => normalizedName(entry) === normalizedName(candidate))) return list;
  return [...list, { name: candidate.name.trim() }];
}
