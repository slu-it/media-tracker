import type { GroupSort } from "./groupViewParams";
import type { MediaGroup } from "./groups";

/**
 * `name` returns the input array itself (the backend's alphabetical order); `volume` returns a copy by item count descending.
 * `Array.prototype.sort` is stable, so equal counts keep the input order.
 */
export function sortGroups<T extends MediaGroup>(groups: readonly T[], sort: GroupSort): readonly T[] {
  return sort === "volume" ? [...groups].sort((a, b) => b.itemCount - a.itemCount) : groups;
}
