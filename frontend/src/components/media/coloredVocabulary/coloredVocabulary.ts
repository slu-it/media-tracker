/** An editable entry of a colored vocabulary (platform, book type) with its usage count. */
export interface ColoredEntry {
  id: string;
  label: string;
  /** `RRGGBB`, no `#`. */
  associatedColor: string;
  /** How many items use the entry. */
  count: number;
}

export interface ColoredEntryUpdate {
  label?: string;
  associatedColor?: string;
}

/** Kind-specific, already translated texts of the editor. */
export interface ColoredVocabularyLabels {
  /** Shown while the list has no entries. */
  empty: string;
  /** The usage count, e.g. "3 books". */
  count: (count: number) => string;
  /** Label of the add form's name field, e.g. "New book type". */
  addLabel: string;
  /** aria-label of the swatch button of an entry. */
  changeColor: (name: string) => string;
  /** aria-label of the add form's swatch button. */
  newColor: string;
  editName: (name: string) => string;
  deleteLabel: (name: string) => string;
  deleteQuestion: (name: string) => string;
  /** Tooltip of the disabled delete button of an entry in use. */
  deleteInUse: string;
  loadFailed: string;
}
