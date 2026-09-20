# 0017: Ownership, progress and hidden as code enums on the game itself

Status: accepted, 2026-09

## Context

MT-007 adds three status fields to a game: `ownership` (watchlist, owned), `progress` (not started, playing,
finished, completed, paused, abandoned) and `hidden` (a boolean). They record the owner's relationship to a game
rather than a property of the game, every game has all three from the moment it is created, and each value of the
two enums is shown as its own icon. Acting on them (filtering the list, hiding hidden games) is a later story; this
change only collects and displays them.

Decision record 0009 made the comparable-looking `platforms` a seeded `game_platforms` table with labels and
colours in the database. The question was whether these three follow that pattern.

## Decision

- **Closed sets stay in code.** `Ownership` and `Progress` are Kotlin enums in `games/domain/GameStatus.kt`, not
  reference tables. The two sets are not owner-extensible: every value carries behaviour (its icon today, list
  filters tomorrow), so a new value is a code change anyway, and a row in a table could never supply it. This is
  the counterpart to record 0009, and the rule for the next media kind is the distinction itself: extensible
  vocabulary with display data becomes a seeded table, a closed set the code branches on becomes an enum.
- **One vocabulary everywhere.** The wire value is derived, `val wire: String get() = name.lowercase()`, and that
  same string is what the column holds, what the REST DTOs carry and what the MCP tool schemas advertise
  (`"watchlist"`, `"not_started"`, …). `from(wire)` throws `InvalidValueException` for anything else, so an
  unknown value is a 400 `validation_error` like any other invalid field. The JSON-schema `enum` arrays in
  `GameMcpTools.kt` are built from `entries`, so the tool contract cannot drift from the domain. The columns are
  plain `VARCHAR(32)`, not MariaDB `ENUM`: Exposed's drift check would see a type it does not model, and the
  allowed values are already enforced one layer up.
- **The "100%" state is called `completed`.** The number stays out of the identifier; "100%" is the label the
  frontend renders for it. `finished` means the game was played to its end, `completed` that there was nothing
  left to do in it.
- **The domain owns the defaults.** A new game is `watchlist` / `not_started` / not hidden, expressed as Kotlin
  default arguments on `Game` and `NewGame`. `V006__games_statuses.sql` adds each column `NOT NULL DEFAULT <x>`
  to backfill the existing rows and then drops the column default again, and `GamesTable` declares no `.default()`.
  Two reasons: the default is then written down once, and `SchemaDriftTest` compares column defaults in both
  directions, so a database default without a matching Exposed default (or the reverse) fails the build. The
  repository writes every column on every insert, so no default is needed at runtime; raw Exposed inserts in tests
  must therefore set the three columns themselves.
- **Unclearable patch fields are plain nullables.** On `GamePatch` the three are `Ownership?` / `Progress?` /
  `Boolean?` where null means *unchanged*, like the existing `title`, `releaseYear` and `platformIds`, not
  `Patch<T>`: a value that has a default and can never be absent cannot be cleared either. The MCP `update_game`
  tool consequently lists them in `UPDATE_GAME_UNCLEARABLE`, so an explicit `"ownership": null` is rejected
  instead of being read as "leave it alone".
- **Icon vocabulary** (MUI, imported by path; `owned` and `not_started` deliberately show nothing, so an icon
  always means "this game is not simply owned and unplayed" - note that the *default* ownership, `watchlist`, is
  one of the loud values, so a freshly added game does carry the watchlist icon):
  watchlist `ShoppingCartOutlined`, playing `SportsEsports`, finished `CheckCircle`,
  completed `EmojiEvents`, paused `PauseCircle`, abandoned `DoNotDisturb`, and `hidden` (only when true)
  `VisibilityOffOutlined`. All three axes render through one component, `GameStatusIcons`, after the title in the
  game detail dialog and on the grid card. The labels behind the icons live in the i18n bundles, not in the
  database, because unlike platform labels they are not data; `hidden` reuses `games.fields.hidden`, which also
  labels the checkbox that still sets it in the add/edit form.

  Watchlist started as `VisibilityOutlined` and `hidden` as a read-only checkbox at the end of the detail
  dialog's fields. Both changed once the UI was real: a struck-through eye is the obvious icon for "hidden", which
  made an eye for "watchlist" confusable, so watchlist moved to the cart. The lesson for the next media kind is
  the constraint, not the glyphs: the icons are a set, and each one has to stay legible next to the others.

## Alternatives not taken

- Two seeded reference tables like `game_platforms`: no value without an owner-facing admin screen, and the icon
  for each value would still be a `when` in the frontend.
- MariaDB `ENUM` columns: the allowed values would live in a migration as well as in the enum, and altering the
  set would mean a table rebuild.
- `Patch<Ownership>` for symmetry with description and rating: it would add a third state ("clear") that the
  domain has no meaning for.
- Storing the Kotlin constant name (`NOT_STARTED`) in the column, as Exposed's `enumerationByName` does: the
  database would then read differently from the API for no gain, and that column type also drops the `VARCHAR`
  length check the drift test still performs.

## Consequences

- The next media kind copies `GameStatus.kt` for its own closed sets; ownership and progress are likely to be
  shared vocabulary across kinds (a book is read, a series watched), so the first kind that needs the same values
  should consider moving these enums to `common/domain` rather than duplicating them.
- Search, listing and paging are untouched: hidden games are still listed, and the new columns are not indexed.
  A later filter story adds the index together with the query.
