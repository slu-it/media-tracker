# 0043: Book types and game platforms are edited in the settings dialog

Status: accepted, 2026-10

## Context

Game platforms (record 0009) and book types (record 0034) are seeded reference rows: a fixed UUID, a unique label
and a chip colour. The API only lists them; record 0009 left "an admin UI for platforms" as a later story. The owner
wants to add, rename, recolour and delete them. Unlike authors or developers, they are few and act as configuration,
so they belong in the settings dialog rather than in a group view of their own.

## Decision

- **Two settings tabs**, "Books Configuration" and "Games Configuration". Each holds one section today ("Book types",
  "Platforms"), so later per-kind settings can join them. `features/settings` composes the tabs, which live in
  `features/books` and `features/games`; a kind never imports from settings.
- **One row per entry**: the colour swatch (a button that opens the colour picker), the name (edited inline: Enter
  saves, Esc cancels), the chip as it looks on cards, and the number of books or games that use it. An "Add" form
  below the list creates an entry with a name and a colour.
- **Colours** come from a palette of 16 presets (the 8 seed colours and 8 MUI 600 to 700 shades, none near white or
  near black, so they read on both themes) or a hex field. They are stored as uppercase `RRGGBB`; the chip text
  colour still follows `getContrastText`.
- **API** (books shown; platforms are the same under `/api/game-platforms`, with `gameCount`):
  - `GET /api/book-types.summaries`: every type with its `bookCount`, by label (one `LEFT JOIN` and `COUNT`).
  - `POST /api/book-types {label, associatedColor}`: 201 with `Location`.
  - `PATCH /api/book-types/{id} {label?, associatedColor?}`: only the sent fields change; 400 when both are missing.
  - `DELETE /api/book-types/{id}`: 204, 404, or 409 `conflict` while a book uses it.
  - A taken name (under the table collation, so case and accent variants count) is a 409 `name_taken` with
    `existingId`/`existingName`, as in record 0041. The entry's own name is excluded, so a case fix is an update.
  - `GET /api/book-types`, `GET /api/game-platforms` and the MCP tools `list_book_types`/`list_game_platforms` are
    unchanged.
- **No merge.** With a handful of entries a taken name is a typo, so it is an inline error, not a merge offer.
- **Delete only while unused**, as in record 0041: the delete button is disabled with a tooltip while the count is
  above 0. The `ON DELETE RESTRICT` foreign keys remain the backstop against a concurrent link
  (`deleteUnusedVocabularyEntry`). This also keeps the "at least one platform per game" rule intact.
- **Order stays alphabetical by label**; there is no position column.
- **Shared code**: `common/persistence/ExposedColoredVocabulary.kt` holds create, update, delete and summaries for
  both tables, with the same row locks and duplicate-key handling as `ExposedNameVocabulary.rename`. The frontend
  editor (`components/media/coloredVocabulary/`), the colour picker and `HexColorField` are kind-neutral and take
  translated labels.
- **Open views refresh when the dialog closes.** After a change the settings button bumps a data revision, and
  `App.tsx` remounts the routed view with it. The view state lives in the URL (record 0031), so search, filters and
  page survive, while cards, `.meta` and the loaded types and platforms reload. An import that inserts or updates
  rows bumps it too.
- **Backup restores the configuration.** The import (record 0027) only inserts rows with a new primary key, so an
  edited seed row would come back with its seed name and colour. For `book_types` and `game_platforms` only, a row
  whose id exists gets its label and colour overwritten, reported per table as `updated`, after the same label and
  colour checks as the API. The updates run in two phases (placeholders first), so swapped or chained renames work; a
  label held by a row the file does not update is still a 400 that rolls back that source. Restoring an older file
  therefore also resets later name and colour edits; the import asks no confirmation, as before.
- **No MCP write tools**, as in record 0041.

## Alternatives considered

- **A group view per kind** like authors: too heavy for four to eight entries, and these are configuration.
- **Delete with move to another entry** or **unlinking on delete**: changes books or games silently, or cannot
  work for a game's only platform. Reassigning first stays manual.
- **Manual order with drag handles**: needs a position column; alphabetical order was enough for the owner.
- **Refreshing the views live** while the dialog is open: nothing visible behind the modal needs it, and every hook
  would have to know about the change.

## Consequences

- Record 0009's "read-only API for now" and "admin UI is a later story" are superseded by this record; record
  0034's types follow.
- Backend tests no longer treat the two tables as static: `resetSeededReferenceData()` restores the four seeded
  rows of each.
- The seeded UUIDs stay the canonical ids in tests and fixtures, but in a real database a seed may have been
  renamed, recoloured or deleted.
