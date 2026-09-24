# Title suggestions (MT-019)

ADR: [0026](../decisions/0026-title-suggestions-degrade-to-empty.md). Code: `games/domain/CoverOptionsService.kt`
(`suggestTitles`), `games/api/CoverOptionRoutes.kt`, `frontend/src/features/games/hooks/useTitleSuggestions.ts`,
`frontend/src/features/games/components/fields/GameTitleField.tsx`.

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
