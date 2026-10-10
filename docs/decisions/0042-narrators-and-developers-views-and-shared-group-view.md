# 0042: Narrators and developers get group views like authors, on a shared group view

Status: accepted, 2026-10

## Context

Record 0041 made book authors and series renamable, mergeable and (while unused) deletable in their group views, and
left narrators out because they had no view. Book narrators (record 0035) and game developers (record 0029) are the
same kind of user-created vocabulary, with the same gaps: typos stay, duplicates cannot be joined, orphans are kept.
The group view (search, one accordion per entry, items on expand, rename/merge/delete toolbar) lived in
`features/books/`, written for books.

## Decision

- **A narrators sub-page for books** (`/books/narrators`, between authors and series) and **a developers sub-page
  for games** (`/games/developers`, after the ranking). Both work like the authors view: every entry with its item
  count, those without items included; expanding loads its books or games; rename, merge on a taken name, and
  delete only while unused.
- **Same API shape as authors** (record 0041): `GET /api/book-narrators.summaries`, `GET /api/book-narrators/{id}/books`,
  `PATCH`, `POST .../merge {targetId}` and `DELETE /api/book-narrators/{id}`, and the same under `/api/game-developers`
  with `/{id}/games` and `gameCount` in the summaries. Same status codes, `name_taken` with `existingId`/`existingName`,
  row locks and race handling.
- **One junction merge and one guarded delete for all plain links.** Authors, narrators and developers merge the same
  way (both rows locked in id order, missing links to the target inserted, the source's links and row deleted).
  `common/persistence/VocabularyLinks.kt` holds that move (`mergeVocabularyEntries`, used by all three; series keep
  their own merge because of the position rule) and the delete-while-unused (`deleteUnusedVocabularyEntry`, used by
  all four). `DeleteOutcome` moves from `books/domain` to `common/domain/Vocabulary.kt`.
- **Item order**: a narrator's books like an author's (release year, date, title); a developer's games in the games
  release order (`GameSort.RELEASE_ASC`).
- **The group view is shared** in `frontend/src/components/media/groups/` (`MediaGroupsView`, `MediaGroupAccordion`,
  `RenameGroupDialog`), generic over the item type, with `useGroupItems`, `nameSearch` and `groupViewParams` next to
  the other shared building blocks (record 0034). Shared code builds no i18n key from a kind name, so every text
  arrives as an already translated `labels` object; each kind builds it from its own keys (`books.authorsView`,
  `books.narratorsView`, `books.seriesView`, `games.developersView`) in a feature hook. The kind passes its card,
  cover ratio, loaders and dialogs host.
- **No MCP tools** for these actions, as in record 0041.

## Alternatives considered

- **Copy the books group view into games**: about 400 duplicated lines that would drift apart.
- **Pass an i18n prefix into the shared view**: breaks the rule that shared code builds no keys from a kind name, and
  the key set would be checked by nobody.
- **Read-only narrator and developer views**: the cleanup the views are for would stay impossible.

## Consequences

- Record 0041's open point "narrator rename, merge and delete" is closed.
- A further grouping (e.g. a future movie director) is a summaries/items/rename/merge/delete API, a labels hook and a
  thin wrapper view.
