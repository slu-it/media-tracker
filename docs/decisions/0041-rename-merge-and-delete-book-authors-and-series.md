# 0041: Book authors and series can be renamed, merged into an existing entry, and deleted while no book uses them

Status: accepted, 2026-10

## Context

Authors and series are user-created vocabulary (records 0029, 0035). A typo stays forever, the same person can end
up twice under different spellings, and orphans are kept: when the last book of an author or series is deleted or
relinked, the entry stays and shows up in the authors and series views with "0 books". Record 0035 lists rename,
merge and delete as an open gap.

## Decision

- **Rename any entry.** `PATCH /api/book-authors/{id}` and `PATCH /api/book-series/{id}` with `{name}` answer 200 with
  the entry, 400 `validation_error` for an invalid name (the `VocabularyName` rules), 404 `not_found` for an
  unknown id.
  - Names stay unique under the table collation (case- and accent-insensitive). Renaming to another spelling of the
    entry's own name (an accent or case fix) is a plain update.
  - A name another entry already has is a **409 `name_taken`**. The error body carries `existingId` and
    `existingName` (new optional fields of `ErrorResponse`), so the client can offer the merge without a lookup.
  - The rename locks the row; a unique-key race with a concurrent create or rename also ends as `name_taken`.
- **Merge on demand.** The client asks before merging: a rename to a taken name opens a choice between "Merge" and
  "Choose another name" (back to the rename dialog, the typed name kept). `POST /api/book-authors/{id}/merge` and
  `POST /api/book-series/{id}/merge` with `{targetId}` move every link of the entry to the target and delete the
  entry, answering 200 with the target; 404 for an unknown entry or target, 400 `validation_error` for a merge into
  itself.
  - Both rows are locked in id order, in one transaction.
  - A book linked to both keeps one link. For series it keeps the target's position, or the merged entry's when the
    target has none.
  - The merge keeps the target's name. A different spelling can be set by renaming the target afterwards.
- **Delete only what no book uses.** `DELETE /api/book-authors/{id}` and `DELETE /api/book-series/{id}` answer 204
  when the entry has no book, 404 for an unknown id and **409 `conflict`** while a book still links it.
  - The check and the delete run in one transaction. The link tables' `ON DELETE RESTRICT` foreign keys stay the
    backstop against a book being linked at the same moment; the repository turns that foreign-key violation into
    the same 409.
  - Deleting an entry in use (and unlinking its books) is not offered: one wrong click would silently change books.
    Merging is the way to get rid of a duplicate that has books.
  - `ConflictException` and `NameTakenException` in `common/domain` map to 409 in `StatusPages`, the first uses of
    that status.
- **The actions live in the expanded section.** MUI 9's `AccordionSummary` is a `<button>`, so no other button can
  sit in the header. Every author and series stays an expandable accordion; its expanded section starts with a
  right-aligned toolbar: a small outlined "Rename" button (always) followed by a red outlined "Delete" button (only with 0 books, behind the
  destructive `ConfirmDialog`). Every success reloads the list, the counts and the open sections.
- **Narrators are left out.** They have no view.
- **No MCP tools** for rename, merge or delete, as for books and games.

## Alternatives considered

- **A non-expandable row for entries without books**, with the delete button next to the count chip: briefly
  implemented, but renaming has to work for every entry, and entries with books keep the button header.
- **Buttons overlaid next to the accordion header** (absolutely positioned siblings): fragile positioning and a
  smaller click target for expanding.
- **Reject a taken name without offering a merge**: leaves duplicates without a way to clean them up.
- **Merge silently on a taken name**: one typo could join two different authors.
- **Delete with cascade of the links**: removes the author or series from books without asking per book.

## Consequences

- Narrator rename, merge and delete stay open.
- A delete racing a book write never leaves a dangling link. The delete gets 409 if the link wins. If the delete
  wins, the book write gets 400 `validation_error` ("unknown author id") when it resolves the id afterwards, or a 500
  when the delete commits between that check and the insert, a window too small to justify locking. A merge racing a
  book write behaves the same way for the merged entry's id.
