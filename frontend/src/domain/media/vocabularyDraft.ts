/** An entry of a user-created vocabulary (game developers, book authors) that already exists in the backend. */
export interface NamedEntry {
  id: string;
  name: string;
}

/**
 * One selected vocabulary chip: either an entry that already exists in the backend's vocabulary, or free-solo
 * text typed by the user that does not (yet) have an id. The host resolves the pending ones (via
 * `resolveVocabularyIds`) into entries before building the create/update request.
 */
export type VocabularyDraft<E extends NamedEntry = NamedEntry> = E | { name: string };

export function isExistingEntry<E extends NamedEntry>(draft: VocabularyDraft<E>): draft is E {
  return "id" in draft;
}

function normalizedName(draft: VocabularyDraft): string {
  return draft.name.trim().toLowerCase();
}

/**
 * Adds `candidate` to `list`, de-duplicating case-insensitively:
 * - an existing entry (has an `id`) already present by `id` is left as-is;
 * - an existing entry whose name matches a *pending* entry already in the list replaces that pending entry
 *   (a suggestion picked after its free-solo name was already typed upgrades the chip instead of duplicating it);
 * - a pending candidate whose (trimmed) name matches any entry already in the list, existing or pending, is
 *   dropped: it never downgrades an existing entry back to a pending one.
 */
export function addEntry<E extends NamedEntry>(
  list: VocabularyDraft<E>[],
  candidate: VocabularyDraft<E>,
): VocabularyDraft<E>[] {
  if (isExistingEntry(candidate)) {
    if (list.some((entry) => isExistingEntry(entry) && entry.id === candidate.id)) return list;
    const pendingIndex = list.findIndex(
      (entry) => !isExistingEntry(entry) && normalizedName(entry) === normalizedName(candidate),
    );
    if (pendingIndex === -1) return [...list, candidate];
    const next = [...list];
    next[pendingIndex] = candidate;
    return next;
  }
  if (list.some((entry) => normalizedName(entry) === normalizedName(candidate))) return list;
  return [...list, { name: candidate.name.trim() }];
}

/**
 * Resolves the drafts to entries right before saving, 1:1 aligned with `drafts` (no dedupe, so a caller can zip
 * the result with per-draft data): existing entries are returned as they are, each pending name is created once
 * via `create`, sequentially, so a failure stops before later names are created. Pending names are keyed by their
 * (trimmed, case-insensitive) name so a repeat of it in the same list is not created twice.
 */
export async function resolveVocabularyEntries(
  drafts: VocabularyDraft[],
  create: (name: string) => Promise<NamedEntry>,
): Promise<NamedEntry[]> {
  const createdByName = new Map<string, NamedEntry>();
  const entries: NamedEntry[] = [];
  for (const draft of drafts) {
    if (isExistingEntry(draft)) {
      entries.push(draft);
      continue;
    }
    const key = normalizedName(draft);
    let created = createdByName.get(key);
    if (created === undefined) {
      created = await create(draft.name);
      createdByName.set(key, created);
    }
    entries.push(created);
  }
  return entries;
}

/**
 * Like `resolveVocabularyEntries`, but only the ids, deduped: a pending name can resolve to an entry already
 * selected elsewhere in the list.
 */
export async function resolveVocabularyIds(
  drafts: VocabularyDraft[],
  create: (name: string) => Promise<NamedEntry>,
): Promise<string[]> {
  const entries = await resolveVocabularyEntries(drafts, create);
  return [...new Set(entries.map((entry) => entry.id))];
}
