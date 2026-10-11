# 0044: Game series like book series, on shared series building blocks

Status: accepted, 2026-10

## Context

Games form series too ("The Legend of Zelda", "Final Fantasy"), sometimes several at once ("Kingdom Hearts" and a
sub-series), with numbers that are not always whole ("Kingdom Hearts 358/2 Days" between #1 and #2) or missing
(spin-offs). Book series (record 0035, with rename, merge and delete from record 0041 and the group view from record
0042) already model exactly this. The owner wants the same behaviour for games: created on the fly, several per game,
the primary series on the grid card, a series view, rename, merge and delete.

## Decision

- **Game series copy book series rule for rule**: vocabulary in `game_series` (V014) on the shared
  `ExposedNameVocabulary`, links in `game_to_series` with `position DECIMAL(6,2) NULL` (0 to 9999.99, at most two
  decimals, `NULL` means "without a number"), at most one link per series, a game's series ordered by name, a
  series' games ordered by position (unnumbered last), then title. The game cascades its links on delete, a used
  series is protected by `RESTRICT`, orphans are kept.
- **Same wire shape as books**: `series: [{seriesId, position?}]` on `POST`/`PATCH /api/games` (the update replaces
  the whole list, a repeated id is a 400), `GameResponse.series: [{id, name, position}]`, and
  `/api/game-series` with search, create, `.summaries` (`gameCount`), `/{id}/games`, rename (409 `name_taken`),
  merge (a game in both keeps the target's position, else the merged one's) and delete while unused (409
  `conflict`). MCP: `search_game_series`, `create_game_series` and `series` on `add_game`/`update_game`.
- **Frontend like books**: the shared series field (chips plus one number input per series) in the game form after
  the developers, all series as chips in the detail view, a `/games/series` group view with a "#n" badge above each
  cover, and the primary series (lowest position, unnumbered after every number, ties by name then id) as an
  outlined chip above the platform chips on the overview and developer cards. A game without series keeps one chip
  row's height empty, so covers line up within a grid row, as on book cards. Watchlist and ranking cards show no
  series, as the book watchlist card does not.
- **Series code becomes kind-neutral** (record 0034's rule for shared building blocks), and books switch over without
  a change in behaviour:
  - backend: `SeriesPosition` in `common/domain`, the position-aware merge in `common/persistence`;
  - frontend: `primarySeries` and the series formatting (`domain/media/seriesLabel.ts`), the position validator in
    `domain/media/values.ts`, the series draft and resolver (`domain/media/seriesDraft.ts`), and `SeriesField` and
    `SeriesPositionField` in `components/media/fields/`. Texts shared by both kinds live under `media.series.*`.
  - The vocabulary tables, ids, DTOs, routes and views stay per kind, like authors and developers.

## Alternatives not taken

- **Duplicating the book series code for games**: two copies of the position rules, the merge and the badge
  heuristic would drift apart.
- **One series table shared by books and games**: a book series and a game series of the same name (a franchise) are
  different things with different members, and record 0034 keeps each kind's domain separate.
- **Showing the series chip only when a game has one**: covers in one grid row would no longer line up.

## Consequences

- Every game card in the overview and developer view grows by one chip row.
- Movies and TV series can reuse the shared series building blocks the same way when they arrive.
- The backup dump (record 0027) carries `game_series` and `game_to_series` through `GamesBackupSource`.
