# Title suggestions (MT-019)

ADR: [0026](../decisions/0026-title-suggestions-degrade-to-empty.md). Code: `games/domain/CoverOptionsService.kt`
(`suggestTitles`), `games/api/CoverOptionRoutes.kt`, `frontend/src/hooks/useTitleSuggestions.ts` and
`frontend/src/components/media/fields/SuggestingTitleField.tsx` (shared with books, ADR 0039),
`frontend/src/features/games/components/fields/GameTitleField.tsx` (games wrapper with the verified icon).

- The title field in `GameForm` (add dialog and the edit mode of the detail dialog) is a `freeSolo` MUI
  `Autocomplete`. Free text stays the normal case, and suggestions are only an offer.
- The field becomes an `Autocomplete` only when the host passes `onSuggestionPick`. `GameForm` does, while
  `ExpansionDialog` (which reuses the field for DLC names, which are not SteamGridDB games) does not and gets the
  plain text field.
- The option's verified icon is announced through `titleAccess`. After a pick, no new search runs for the picked
  name, and the list clears as soon as the live title drops below the minimum. Titles over the 200-character search
  limit send no request.
- After the user's first edit of the title, and once the trimmed title has at least `TITLE_SUGGESTION_MIN_LENGTH`
  (5) characters, the field waits `SEARCH_DEBOUNCE_MS` (500 ms) and then calls
  `GET /api/games/title-suggestions?query=<title>`. Stale responses are ignored.
- The backend runs the SteamGridDB search the cover picker uses (`CoverSource.searchGames`) and returns up to 8
  matches in SteamGridDB's order. Each option shows the name, the year when known and a verified hint. A
  suggestion equal to the current title is hidden.
- A pick sets the title and, when the match has a year, overwrites the release year. Platforms are untouched.
- Without `STEAMGRIDDB_API_KEY`, or when SteamGridDB fails, the endpoint answers `200` with an empty list
  (failures are logged at warn), and the field renders no suggestions. That differs on purpose from the cover
  picker's 503/502 ([cover picker](cover-picker.md)).

## Books

ADR [0039](../decisions/0039-book-cover-picker-and-title-suggestions.md). Code:
`books/domain/BookCoverOptionsService.kt` (`suggestTitles`), `books/api/BookCoverOptionRoutes.kt`,
`frontend/src/features/books/components/fields/BookTitleField.tsx`, `features/books/domain/bookSuggestion.ts`.

- `GET /api/books/title-suggestions?query=<title>[&source=audiobook]` from Open Library (`book`, default) or the
  Audible catalog (`audiobook`); the form derives the source like the cover picker (`defaultCoverSource`: Audible
  type or narrators), and a change of source refetches. No toggle in the field.
- From 3 characters (`BOOK_TITLE_SUGGESTION_MIN_LENGTH`), short titles being common; same debounce. Up to 8,
  deduplicated by title and first author, shown as `Title · Author(s) · Year` (two authors, then "…").
- A pick sets the title, the year only when neither year nor date is set, and authors and (Audible) narrators as
  pending vocabulary chips only when those fields are empty; nothing typed is overwritten.
- Unlike games, a suggestion equal to the typed title stays visible (`hideExactMatch={false}`): picking it is how
  the authors, narrators and year of an exact title get filled in.
- A failing provider yields `200` with an empty list, as for games. Tests that type a book title mock
  `GET /api/books/title-suggestions`.
