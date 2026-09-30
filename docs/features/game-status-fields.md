# Game status fields (MT-007)

ADR: [0017](../decisions/0017-game-status-fields.md) (closed sets are enums; extensible vocabulary is a seeded
table as in ADR 0009).

- Three fields on a game: `ownership` (`watchlist`, `owned`), `progress` (`abandoned`, `not_started`, `paused`,
  `playing`, `finished`, `completed`) and the boolean `hidden`. Enum declaration order is the order every
  dropdown, `/api/games.meta` and the MCP schemas offer (the owner's order since 2026-09-30); the frontend
  mirrors it in `PROGRESS_VALUES`. The ordinal is never persisted.
- Kotlin enums in `games/domain/GameStatus.kt`. Their `wire` value (`name.lowercase()`) is what the
  `VARCHAR(32)` column, the DTOs, the TypeScript union types and the MCP tool schemas all use. The domain owns
  the defaults; the columns declare none (see `.claude/rules/schema-migrations.md`).
- Set on create and edit, shown as icons after the title in the detail dialog (all of them) and on the grid
  and expansion cards (`GameStatusIcons variant="card"`: watchlist icon only for watchlist games, progress icon
  only for owned ones, hidden icon either way). Progress icons also prefix the options of the progress filter
  (`components/OptionIconSlot.tsx`; the map lives in `components/progressIcons.ts`). The fields do not affect
  search, listing or paging; `ownership` and `progress` became filterable with MT-011.
- Progress is picked with `ProgressToggleBar` everywhere (there is no progress dropdown): six small exclusive
  icon buttons in `PROGRESS_VALUES` order, labels only as tooltip / accessible name.
  - Game view, add and edit dialogs: under the rating in the cover column, 32px below it (twice
    `CoverAndInfoLayout`'s cover gap). Both blocks carry the same small legend (`fields/FieldLegend.tsx`,
    "Rating" / "Progress"; the view dialog renders `RatingField` too). In the add/edit form the Hidden checkbox
    sits next to Ownership instead.
  - Expansion dialog: under the "Progress" label in view, add and edit mode.
  - In view mode (game and expansion) a click PATCHes `{ "progress": ... }` alone and stays in view mode; an
    error shows the dialog's error and reverts the pressed button. In add/edit it only changes the draft.
- Quick rating change: in the game view dialog the stars are editable too and PATCH `{ "rating": ... }` alone
  through the same flow; clicking the current value clears the rating (`{ "rating": null }`), as in the edit form,
  without confirmation or undo (owner's choice). While one quick save runs, both the stars and the progress bar
  ignore input (`aria-busy`, dimmed) instead of being disabled, so keyboard focus stays put.
- `RatingField` (view and add/edit) previews the hovered value in the number under the stars and falls back to
  the actual value when the pointer leaves; no preview while read-only, disabled or saving.
- Expansions reuse `Ownership` and `Progress` verbatim (MT-016).
