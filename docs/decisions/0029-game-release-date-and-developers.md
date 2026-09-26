# 0029: An optional release date that overrides the year, and developers as user-created vocabulary

Status: accepted, 2026-09

## Context

The release year groups a collection well enough, but a wishlist needs the day a game comes out. Games also have
one or more developers. Like platforms (record 0009), a developer is shared by many games. Unlike platforms,
there are far too many of them to seed, so the owner and agents create them while entering a game.

## Decision

- **`games.release_date DATE NULL` next to the required `release_year`.** When a date is set, its year is the
  game's year, and that is stored, not only displayed. The domain enforces it: `Game` requires
  `releaseYear == releaseDate.year`, `NewGame` derives the year from the date, and `GamePatch.applyTo` lets the
  date win. A contradicting year in the same request is overridden, a year-only patch on a dated game keeps the
  date's year, and clearing the date keeps the current year. `CreateGameRequest.releaseYear` may be omitted when
  a date is given. The year filters and `/api/games.meta` stay year-based.
- **The date column binds `java.time.LocalDate` through JDBC 4.2** (`setObject`/`getObject(..., LocalDate)`,
  `common/persistence/LocalDateColumnType.kt`). Exposed's own date column converts through epoch millis in the
  JVM zone. With `timezone=UTC` on the JDBC URL and a Europe/Berlin JVM, that returned the day before. A
  repository test pins the round trip under a far-off default zone.
- **Developers are rows in `game_developers`** (UUID, `name VARCHAR(128)`, unique and FULLTEXT), linked through
  `game_to_developer`. The unique index uses the case- and accent-insensitive `utf8mb4_uca1400_ai_ci`
  collation, so "nintendo" and "Nintendo" (and "Café" and "Cafe") are one developer. `POST /api/game-developers`
  and the MCP tool `create_game_developer` are idempotent: an existing name returns the existing row instead of
  failing (REST 200 instead of 201, MCP `created: false`).
- **Lookup is a prefix fulltext search plus a name prefix match** (`GET /api/game-developers?search=&limit=`,
  MCP `search_game_developers`). The fulltext half reuses `FulltextQuery.booleanMode` from record 0015 and ranks
  by relevance. InnoDB never indexes words under three characters or stopwords, so a `name LIKE 'term%'` match
  is OR-ed in, and "EA" or "2K" stay findable. A blank term lists alphabetically.
- **Games reference developers only by id** (`developerIds`, like `platformIds`). The frontend creates the
  developers typed as new text first, one `POST` per new name, and then saves the game. Agents do the same with
  `search_game_developers`, then `create_game_developer`, then `add_game`/`update_game`.
- **Developers nobody references are kept.** An agent creates one before the game exists, and a kept name stays
  suggestible.
- **The date picker is MUI X `DatePicker` on dayjs.** Its input format is built from
  `Intl.DateTimeFormat(navigator.language).formatToParts()`, falling back to `YYYY-MM-DD`, and the view dialog
  formats with the same string.
- **Backups cover the new tables.** A missing nullable column in an imported row now defaults to `null`, so
  exports taken before this record still import.

## Alternatives not taken

- **Creating new developers inside the game request** (`developers: [{id} | {name}]`, one transaction):
  atomic, but it gives the game endpoints a second vocabulary shape. The owner preferred the simpler API and
  accepted that a failed game save can leave an unused developer behind, which is kept anyway.
- **A native `<input type="date">`**: no dependency, and the browser formats it, but it looks different in
  every browser. The owner chose the MUI X picker.
- **A seeded developer table like platforms**: the vocabulary is open-ended.
- **Deleting orphaned developers**: this would race with agents that create a developer before the game.
- **Storing the date as `VARCHAR(10)`**, or forcing the JVM default zone to UTC: the first loses the column type,
  the second is a cross-cutting change to fix one binding.

## Consequences

- Before a date is set, the year stays editable. Afterwards it is derived, and the add/edit dialog disables it.
- Typos create new developers. Text in the developer field that is not yet a chip is committed on blur, so it
  is not lost on save. There is no rename, merge or delete yet.
- Two new runtime dependencies in the frontend: `@mui/x-date-pickers` and `dayjs`.
