import type { MediaGroup } from "../../../domain/media/groups";

/** Maps summary responses (`bookCount`) to the shared group shape (`itemCount`). */
export function toMediaGroups(summaries: { id: string; name: string; bookCount: number }[]): MediaGroup[] {
  return summaries.map(({ id, name, bookCount }) => ({ id, name, itemCount: bookCount }));
}
