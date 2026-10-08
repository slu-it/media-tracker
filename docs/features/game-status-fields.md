# Game status fields (MT-007)

ADR: [0017](../decisions/0017-game-status-fields.md) (closed sets are enums; extensible vocabulary is a seeded
table as in ADR 0009).

- Three fields on a game: `ownership` (`watchlist`, `subscription`, `owned`), `progress` (`abandoned`,
  `not_started`, `paused`, `playing`, `finished`, `completed`) and the boolean `hidden`. Enum declaration order
  is the order every dropdown, `/api/games.meta` and the MCP schemas offer (the owner's order since 2026-09-30);
  the frontend mirrors it in `OWNERSHIP_VALUES` and `PROGRESS_VALUES`. The ordinal is never persisted.
- Kotlin enums in `games/domain/GameStatus.kt`. Their `wire` value (`name.lowercase()`) is what the
  `VARCHAR(32)` column, the DTOs, the TypeScript union types and the MCP tool schemas all use. The domain owns
  the defaults; the columns declare none (see `.claude/rules/schema-migrations.md`).
- Set on create and edit, shown as icons after the title in the detail dialog (all of them) and on the grid and
  expansion cards (`GameStatusIcons variant="card"`: ownership icon for watchlist and subscription games,
  progress icon for subscription and owned ones, so a subscription game shows both; hidden icon either way). The
  overview filters ownership and progress through toggle buttons with the same icons (`StatusFilterToggles`, see
  [game-search-and-filters.md](game-search-and-filters.md); the maps live in `components/ownershipIcons.ts` and
  `progressIcons.ts`). The fields do not affect search, listing or paging; `ownership` and `progress` became
  filterable with MT-011.
- Progress is picked with `ProgressToggleBar` everywhere (there is no progress dropdown): six small exclusive
  icon buttons in `PROGRESS_VALUES` order, labels only as tooltip / accessible name. It wraps
  the shared `StatusToggleBar` (`src/components/media/status/`), whose `multiple` mode backs the overview's progress and ownership filters. Pressed buttons
  show their icon in the theme's primary colour (`color="primary"`), like the selected page button.
  - Game view, add and edit dialogs: in the cover column, order Rating → Ownership → Progress, each block 16px
    below the previous one (`CoverAndInfoLayout`'s cover gap; it was twice that until all three blocks existed
    and the owner found the gaps too big). All three carry the same small legend
    (`fields/FieldLegend.tsx`; the view dialog renders `RatingField` too).
  - Expansion dialog: under the "Progress" label in view, add and edit mode.
  - In view mode (game and expansion) a click PATCHes `{ "progress": ... }` alone and stays in view mode; an
    error shows the dialog's error and reverts the pressed button. In add/edit it only changes the draft.
- Ownership is picked with `OwnershipToggleBar` everywhere (there is no ownership dropdown): three exclusive
  icon buttons in `OWNERSHIP_VALUES` order (watchlist, subscription, owned) on the same `StatusToggleBar` as
  progress, labels only as tooltip / accessible name. Same places and the same view-mode quick save
  (`{ "ownership": ... }`) as the progress bar; in the expansion dialog it sits under the "Ownership" label above
  Progress. Until 2026-10-04 it was `OwnershipSwitch`, a two-state MUI `Switch` whose thumb carried the
  current state's icon; the third value `subscription` (a game playable only through PlayStation Plus, Game Pass
  and the like) ended that.
- Quick rating change: in the game view dialog the stars are editable too and PATCH `{ "rating": ... }` alone
  through the same flow; clicking the current value clears the rating (`{ "rating": null }`), as in the edit form,
  without confirmation or undo (owner's choice). While one quick save runs, the stars, the ownership bar and
  the progress bar ignore input (`aria-busy`, dimmed) instead of being disabled, so keyboard focus stays put.
- `RatingField` (view and add/edit) previews the hovered value in the number under the stars and falls back to
  the actual value when the pointer leaves; no preview while read-only, disabled or saving.
- Expansions reuse `Ownership` and `Progress` verbatim (MT-016).
