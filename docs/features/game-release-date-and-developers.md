# Game release date and developers (MT-025)

ADR: [0029](../decisions/0029-game-release-date-and-developers.md).
Code: `games/domain/` (`ReleaseDate`, `GameDeveloper*`, `GameDeveloperService`), `games/persistence/`
(`ExposedGameDeveloperRepository`), `common/persistence/LocalDateColumnType`, `frontend/src/features/games/` (`ReleaseDateField`,
`DevelopersField`, `domain/releaseDate.ts`, `domain/developerDraft.ts`, `hooks/useDeveloperSuggestions.ts`).

## Release date

- `games.release_date` is optional (`DATE`, migration V010). When it is set, its year is the stored
  `release_year`: the domain derives the year on create and lets the date win in `GamePatch.applyTo` (a
  contradicting year is overridden, and clearing the date keeps the current year). `POST /api/games` may omit
  `releaseYear` when `releaseDate` (`YYYY-MM-DD`) is given. `PATCH` takes `releaseDate` as a `PatchField`, so
  `null` clears it.
- Search, the four filters and `/api/games.meta` stay on the year.
- The add/edit dialog puts year and date in one row (a column at `xs`). A set date disables the year select,
  which shows the date's year. The picker is MUI X `DatePicker` (dayjs adapter in `AppProviders`). Picker and
  display always use ISO `YYYY-MM-DD` (`RELEASE_DATE_FORMAT`), whatever the language: browsers expose only the
  language, not the OS regional date format, so a language-derived format was wrong for multilingual users.
  The field only propagates a complete valid date or a clear. While the typed date is incomplete or invalid,
  Save stays disabled (`onValidityChange` in the dialogs).
- The view dialog shows the formatted date under the label "Release date" instead of the year.

## Developers

- `game_developers` (UUID, unique case-insensitive `name` of at most 128 characters, FULLTEXT) and
  `game_to_developer`. A game lists its developers sorted by name. Developers no game references are kept.
- `GET /api/game-developers?search=&limit=` combines a prefix fulltext search, ranked by relevance, with a
  `name LIKE 'term%'` match. The `LIKE` half covers names under three characters and stopwords, which InnoDB
  never indexes. The limit is 10 by default and 50 at most, and a blank search lists alphabetically. `POST /api/game-developers {name}` is idempotent, returning 201 for a
  new developer and 200 with the existing row for a name that differs only in case. Games take `developerIds`
  (on PATCH it replaces the whole set) and return `developers: [{id, name}]`.
- `DevelopersField` is a multiple free-solo Autocomplete that shows debounced suggestions. Enter on typed text
  picks a suggestion with the same name, or else adds a pending `{name}` chip. So do the `Add "<name>"` option
  and blurring the field with valid text in it. On blur, MUI commits an option picked with the arrow keys
  instead of the typed text. Chips are outlined, small and
  neutral. On save, `resolveDeveloperIds` (`gamesApi.ts`) POSTs every pending name first, then the game is saved
  with the ids. A failure in either step shows the dialog's error and keeps the draft.
- The view dialog shows the developers as outlined chips after the platforms.

## Add/edit field order

Title, Description, Platforms, [Release year | Release date], Developers, Hidden, Cover image URL. The URL moved
last because covers usually come from the [cover picker](cover-picker.md). Ownership and progress are not in this
list: they are the `OwnershipToggleBar` and `ProgressToggleBar` under the rating in the cover column (see
[game status fields](game-status-fields.md)). The view dialog's order is unchanged.

## MCP

- `add_game` and `update_game` take `releaseDate`, which overrides `releaseYear` (`releaseYear` is then
  optional on `add_game`, and `null` clears the date on `update_game`), and `developerIds`.
- `search_games` and the add/update results show the date and the developer names. The structured content
  carries the full `developers`.
- `search_game_developers {query?, pageSize?}` returns `{developers: [{id, name}]}`.
  `create_game_developer {name}` returns `{id, name, created}`. Agents search first, create what is missing,
  then pass `developerIds`.

## Backup

Both new tables are part of `GamesBackupSource`. `ExposedBackupSource` writes `DATE` values as ISO strings, and
a nullable column missing from an imported row defaults to `null`, so exports taken before MT-025 still import.
