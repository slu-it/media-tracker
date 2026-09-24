# Game status fields (MT-007)

ADR: [0017](../decisions/0017-game-status-fields.md) (closed sets are enums; extensible vocabulary is a seeded
table as in ADR 0009).

- Three fields on a game: `ownership` (`watchlist`, `owned`), `progress` (`not_started`, `playing`, `finished`,
  `completed`, `paused`, `abandoned`) and the boolean `hidden`.
- Kotlin enums in `games/domain/GameStatus.kt`. Their `wire` value (`name.lowercase()`) is what the
  `VARCHAR(32)` column, the DTOs, the TypeScript union types and the MCP tool schemas all use. The domain owns
  the defaults; the columns declare none (see `.claude/rules/schema-migrations.md`).
- Set on create and edit, shown as icons after the title in the detail dialog and on the grid card. They do not
  affect search, listing or paging; `ownership` and `progress` became filterable with MT-011.
- Expansions reuse `Ownership` and `Progress` verbatim (MT-016).
