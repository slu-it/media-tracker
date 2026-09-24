# Game expansions (MT-016)

ADR: [0023](../decisions/0023-game-expansions.md). Code: `games/domain/ExpansionService.kt`,
`games/api/ExpansionRoutes.kt`, `games/persistence/GameExpansionsTable.kt`, the expansion components under
`frontend/src/features/games/components/`.

- Expansions (DLC) are the games domain's second aggregate: `game_expansions` (V008) with a cascading FK to
  `games`, a `title`, the game's own `Ownership`/`Progress` types reused verbatim, and a `sequence` the owner
  arranges by hand.
- `ExpansionService` is the sole owner of that sequence. It is dense and zero-based per game (0..n-1): create
  appends, delete re-packs, and a `PATCH` carrying a `sequence` is a *move* (reinsert at that index, renumber
  the rest; an index outside the range is a 400). There is deliberately no `UNIQUE (game_id, sequence)`, because
  a move rewrites several rows in one transaction.
- Routes nest inside the game's `/{id}` block: `/api/games/{id}/expansions[/{expansionId}]`, reusing `gameId()`.
  `UpdateExpansionRequest` uses plain nullable fields because nothing on an expansion is clearable.
- MCP tools `list_expansions` and `add_expansion` cover the agent side.
- The frontend shows them as a drag-sortable card stack inside the game detail dialog (@dnd-kit; the keyboard
  sensor is the tested path, which needs the `Element.prototype.scrollIntoView` stub in `test-setup.ts`).
