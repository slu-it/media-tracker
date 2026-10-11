import { formatSeriesPositionInput, parseSeriesPosition } from "./values";
import { isExistingEntry, resolveVocabularyEntries, type NamedEntry, type VocabularyDraft } from "./vocabularyDraft";

/**
 * A selected series chip plus its position as typed (`"2.5"`, `"2,5"` or empty for no number). The position stays
 * text so an in-progress or invalid edit survives; see `validateSeriesPosition`.
 */
export interface SeriesDraft {
  entry: VocabularyDraft;
  position: string;
}

/** One series link as the backend takes it (`BookSeriesLinkRequest`, `GameSeriesLinkRequest`). */
export interface SeriesLink {
  seriesId: string;
  position?: number | null;
}

/** The drafts of a stored item's series entries, positions in the language's decimal format. */
export function seriesDraftsFromEntries(
  entries: { id: string; name: string; position: number | null }[],
  language: string,
): SeriesDraft[] {
  return entries.map((entry) => ({
    entry: { id: entry.id, name: entry.name },
    position: formatSeriesPositionInput(entry.position, language),
  }));
}

/** The links of the already existing series; the pending ones have no id yet. */
export function existingSeriesLinks(drafts: SeriesDraft[]): SeriesLink[] {
  const links: SeriesLink[] = [];
  for (const { entry, position } of drafts) {
    if (isExistingEntry(entry)) links.push({ seriesId: entry.id, position: parseSeriesPosition(position) });
  }
  return links;
}

function seriesLinkKeys(links: SeriesLink[]): string[] {
  return links.map((link) => `${link.seriesId}|${link.position ?? ""}`);
}

/** Whether both sets of (series, position) pairs are equal, order-insensitive. */
export function sameSeriesLinks(a: SeriesLink[], b: SeriesLink[]): boolean {
  const left = new Set(seriesLinkKeys(a));
  const right = new Set(seriesLinkKeys(b));
  return left.size === right.size && [...left].every((key) => right.has(key));
}

/** The links of a stored item's series entries, to compare with the draft's (see `sameSeriesLinks`). */
export function linksOfEntries(entries: { id: string; position: number | null }[]): SeriesLink[] {
  return entries.map((entry) => ({ seriesId: entry.id, position: entry.position }));
}

/**
 * Resolves a form draft's series to links right before saving: pending names are created via `create`, each
 * position text is parsed (empty means no number), and a series selected twice (a pending name that resolved to an
 * existing one) keeps its first link that has a position, else its first.
 */
export async function resolveSeriesLinks(
  drafts: SeriesDraft[],
  create: (name: string) => Promise<NamedEntry>,
): Promise<SeriesLink[]> {
  const entries = await resolveVocabularyEntries(
    drafts.map((draft) => draft.entry),
    create,
  );
  const links = new Map<string, SeriesLink>();
  entries.forEach((entry, index) => {
    const position = parseSeriesPosition(drafts[index].position);
    // The first link wins, unless it has no position and a later duplicate has one.
    if (links.get(entry.id)?.position == null) {
      links.set(entry.id, { seriesId: entry.id, position });
    }
  });
  return [...links.values()];
}
