import type { ReactElement } from "react";

/** A group (book series, author, narrator; game developer) with its item count. */
export interface MediaGroup {
  id: string;
  name: string;
  itemCount: number;
}

/** The translated texts of one grouping; the kind builds them (shared code builds no key from a kind name). */
export interface GroupLabels {
  searchLabel: string;
  searchPlaceholder: string;
  /** The header count, e.g. "3 authors". */
  count: (count: number) => string;
  /** The chip of a group, e.g. "2 books". */
  itemCount: (count: number) => string;
  empty: string;
  noSearchResults: (term: string) => string;
  /** Shown in an expanded group without items. */
  noItems: string;
  editLabel: (name: string) => string;
  deleteLabel: (name: string) => string;
  deleteQuestion: (name: string) => string;
  renameTitle: string;
  nameLabel: string;
  nameTaken: (existing: string, name: string) => string;
  /** The "most items first" sort option, e.g. "Most books". */
  sortByVolume: string;
  merge: string;
  chooseOtherName: string;
}

export type LoadGroupItems<T> = (id: string, signal: AbortSignal) => Promise<T[]>;
export type RenderGroupCard<T> = (item: T, onClick: () => void, group: MediaGroup) => ReactElement;
