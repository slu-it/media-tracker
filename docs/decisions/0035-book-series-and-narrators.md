# 0035: Book series as vocabulary with an optional position per link, and narrators like authors

Status: accepted, 2026-10

## Context

Books need two more multi-value properties (MT-042):

- **Series**: a named group of one or more books that tell an overall narrative. A book usually belongs to one
  series, rarely to several (Mistborn belongs to "Mistborn" and to "The Cosmere"). Series are created on the fly
  while editing a book, like authors. Within a series a book usually has a number, and that number differs per
  series: Mistborn is #1 of "Mistborn" but has no single number in "The Cosmere". Numbers are not always whole
  (a novella between #2 and #3 is often #2.5) and a prequel can be #0.
- **Narrators**, for audiobooks: zero or more people, created on the fly, with nothing stored per link.

## Decision

- **Narrators follow record 0029 exactly as authors do** (record 0034): `book_narrators` and `book_to_narrator`
  on the shared `ExposedNameVocabulary`, idempotent case- and accent-insensitive create, prefix fulltext lookup,
  created by the client before the book is saved, unreferenced names kept. The field is shown for every book,
  not only for Audible ones, because a book's types are optional and can change.
- **Series are vocabulary too**, in `book_series`, with the same rules as authors and narrators.
- **The position belongs to the link, not to the book or the series.** `book_to_series` has
  `position DECIMAL(6,2) NULL`. `BookSeriesPosition` in the domain allows `0` to `9999.99` with at most two
  decimals. `NULL` means "in this series, without a number". A book has at most one link per series.
- **On the wire the position is a JSON number**: `series: [{seriesId, position?}]` in the create and update
  requests, `series: [{id, name, position}]` in `BookResponse`. The update replaces the whole list, as for
  `authorIds`. A repeated `seriesId` is a 400.
- **A book's series are ordered by series name**, like authors. There is no owner-defined order.
- **The frontend keeps the shared `VocabularyField` for the series chips** and shows one number input per
  selected series below it. The detail view shows "Mistborn #1" (number formatted for the active language), or
  only the name when there is no number.
- **Series and narrators are not searched, filtered or sorted on** in this ticket.

## Alternatives not taken

- **A series and a number on the book itself**: cannot express a book in two series with different numbers.
- **The number as free text** ("Book One", "2.5"): cannot be sorted or validated, and a later "list a series in
  order" view would have to parse it.
- **An integer position**: excludes the common half-step numbering of novellas.
- **Number inputs inside the chips**: MUI's autocomplete chips take keyboard focus and Backspace for removal,
  so an input inside a chip fights the autocomplete.

## Consequences

- A "books of a series, in order" view or filter can sort by `position` directly later.
- The vocabulary rename, merge and delete gap of record 0029 now applies to narrators and series as well.
- The backup dump (record 0027) carries the new tables through `BooksBackupSource`, including a DECIMAL column.
