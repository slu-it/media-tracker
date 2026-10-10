# Books and games configuration (settings tabs)

ADR: [0043](../decisions/0043-editable-book-types-and-game-platforms.md), building on
[0009](../decisions/0009-game-platforms-as-reference-data.md) and [0034](../decisions/0034-books-and-shared-media-building-blocks.md).

Code:
- **Backend:**
  - `common/persistence/ExposedColoredVocabulary.kt` (summaries, create, update, delete for a label-and-colour table)
    and `VocabularyLookup.kt` (the collation-aware label lookup shared with `ExposedNameVocabulary`).
  - `CreateOutcome`/`RenameOutcome`/`DeleteOutcome` in `common/domain/Vocabulary.kt`; `HexColor.parse` in `MediaValues.kt`.
  - `books/domain/BookTypeService.kt`, `games/domain/GamePlatformService.kt`; `ExposedBookTypeRepository`,
    `ExposedGamePlatformRepository`; the routes in `BookRoutes.kt` / `GameRoutes.kt`.
  - The backup update: `ExposedBackupSource(updatableTables = …)` in `BooksBackupSource` / `GamesBackupSource`.
- **Frontend:**
  - Shared: `components/media/coloredVocabulary/` (`ColoredVocabularyEditor`, `ColoredVocabularyRow`,
    `AddColoredEntryForm`), `components/media/ColorPickerPopover.tsx`, `components/media/fields/HexColorField.tsx`,
    `domain/media/colorPalette.ts`, and the hex and label validators in `domain/media/values.ts`.
  - Kinds: `features/books/components/BooksConfigurationTab.tsx`, `features/games/components/GamesConfigurationTab.tsx`,
    and the api functions in `booksApi.ts` / `gamesApi.ts`.
  - Dialog and refresh: `features/settings/UserSettingsDialog.tsx`, `components/layout/SettingsButton.tsx`,
    `hooks/dataRevision.ts`, `components/DataRevisionProvider.tsx`, and the keyed `Container` in `App.tsx`.

## Behaviour

- The settings dialog has the tabs "Books Configuration" (section "Book types") and "Games Configuration" (section
  "Platforms"), after Export / Import. The tab bar scrolls when it does not fit.
- **The list** has one row per entry, in alphabetical order:
  - the colour swatch, a button that opens the colour picker;
  - the name, a button ("Rename …") that turns into a text field;
  - the chip as cards show it;
  - the count ("12 books", "1 game");
  - a delete button.
  On a phone a row takes two lines: swatch, name and delete, then chip and count.
- **Renaming** inline: Enter saves, Esc and blur cancel (Esc does not close the dialog). An unchanged name sends
  nothing. While saving, the field turns read-only rather than disabled, so focus stays in it. A name another entry holds, also as a case or accent variant, shows "Name already in use" at the field.
  A case fix of the entry's own name is allowed.
- **Colour picker**: 16 preset swatches (named for screen readers, e.g. "Blue (#0070D1)"), a hex field (with or without `#`, stored uppercase without it), and a live
  chip preview. Apply is disabled while the hex is invalid.
- **Adding**: the form below the list takes a name and a colour, which starts on the first palette colour no entry
  uses yet.
- **Deleting** is possible only while the count is 0. Otherwise the button is disabled, with a tooltip saying the
  entry is in use. At 0 a destructive confirmation asks first. If a book or game links the entry in the
  meantime, the 409 reloads the list and shows an error.
- Every change reloads the list. **When the dialog closes after a change**, the open view remounts (data revision),
  so cards, filter options, the add speed dial and the add/edit dialogs show the new names and colours. Search,
  filters and page stay because they live in the URL. A backup import with inserted or updated rows does the same.

## API

Books under `/api/book-types`, platforms the same under `/api/game-platforms` with `gameCount`:

| Request | Answer |
|---|---|
| `GET …/book-types.summaries` | 200 `[{id, label, associatedColor, bookCount}]`, by label, then id |
| `POST …/book-types {label, associatedColor}` | 201 + `Location` + `{id, label, associatedColor}`; 400 `validation_error`; 409 `name_taken` (`existingId`, `existingName`) |
| `PATCH …/book-types/{id} {label?, associatedColor?}` | 200; 400 when both are missing or invalid; 404; 409 `name_taken` |
| `DELETE …/book-types/{id}` | 204; 404; 409 `conflict` while in use |

- The label is trimmed, 1 to 64 characters. The colour is six hex digits without `#`, stored uppercase.
- Create looks for a holder of the label under the table collation and relies on the unique index for a race; update
  locks the row `FOR UPDATE` and looks for another holder, excluding its own id. Either way a unique-key race ends as
  `name_taken`. Delete uses `deleteUnusedVocabularyEntry`, with the `ON DELETE RESTRICT` foreign keys as
  backstop.
- `GET /api/book-types`, `GET /api/game-platforms` and the MCP list tools are unchanged; there are no MCP write tools.
- The backup import overwrites label and colour of existing rows in these two tables and reports them as `updated`
  ([export-import.md](export-import.md)). It checks the same label and colour rules as the API first.

## Testing

- **Backend:**
  - Repository tests for both tables: summaries, create, update and delete, including taken names, the race seam,
    and use by a book or game.
  - Service tests and route tests (`BookTypeRoutesTest`, `GamePlatformRoutesTest`), one smoke path per kind, and
    the backup round trip in `ExposedBackupSourceTest`.
  - `withFreshDatabase` restores the seeded rows through `resetSeededReferenceData()`.
- **Frontend:**
  - The validators, `HexColorField`, `ColorPickerPopover` and `ColoredVocabularyEditor` (rename, Esc,
    `name_taken`, recolour, delete states, add).
  - The two kind tabs, `UserSettingsDialog` and `ExportImportTab`, and the remount on close in `App.test.tsx`.
- The phone layout of a row is checked by eye: jsdom evaluates no breakpoints.
