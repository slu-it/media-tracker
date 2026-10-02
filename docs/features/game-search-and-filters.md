# Game search and filters (MT-003, MT-011 to MT-015)

ADRs: [0015](../decisions/0015-fulltext-game-search.md) (fulltext, Testcontainers),
[0021](../decisions/0021-filterable-game-list.md) (filters, `.meta`),
[0022](../decisions/0022-missing-data-filter-and-mcp-page-size.md) (`hasMissing`, `pageSize`).

## Search (MT-003)

- `GET /api/games?search=` is a MariaDB FULLTEXT search over title and description (score 2x title plus 0.75x
  description, id as tiebreak). The fulltext index `ft_games_title (title)` sits next to the ordinary
  `idx_games_title (title, id)`. The same ADR replaced H2 with a Testcontainers MariaDB for every backend test,
  which is why Docker is a development requirement.
- `SearchTerm` lives in `common/domain`, the `?search` parsing in `common/api/Search.kt`.
- Frontend: a debounced field above the grid (`src/hooks/useDebouncedValue.ts`, `SEARCH_DEBOUNCE_MS` = 500 ms
  since MT-015); `listGames` appends `search=` only when the term is non-blank.

## Filters (MT-011, MT-012, MT-014)

- Four repeatable query parameters on `GET /api/games`: `platform`, `ownership`, `progress`, `releaseYear`.
  Values OR within one filter and AND across filters; any filter takes the same repository branch as a search.
  The platform filter is a semi-join so a game on two selected platforms appears once. `V007` indexes the
  three filterable `games` columns.
- `GET /api/games.meta` returns the values to offer, and only those that occur in a stored game; `.meta` is the
  convention for a resource's lookup data. Release years are listed newest first (MT-014).
- Frontend, overview:
  - Platform and release year are `-all-` multi-selects in `components/GameFilterBar.tsx`, fed by
    `hooks/useGamesMeta.ts`. MT-012 resized them and set the page size to 36. They sit in the two-column
    `controlsLayout="half"` row under the search.
  - Each select with a selection shows a × end adornment that resets it to `-all-` and returns focus to the
    select. MUI `Select` has no built-in clear.
  - A filter change replaces the URL entry and drops `page` ([url-routes.md](url-routes.md)).
- Progress and ownership are icon toggle groups in the results row, right after the count chip
  (`components/StatusFilterToggles.tsx`):
  - Two `StatusToggleBar`s in `multiple` mode, with all six progress and both ownership values in
    `PROGRESS_VALUES` / `OWNERSHIP_VALUES` order.
  - The icons come from `PROGRESS_ICONS` / `OWNERSHIP_ICONS`, the same as the cards and dialogs. The labels
    are tooltips and accessible names.
  - None pressed means no filter. Pressing several ORs within the group, as the selects did.
  - A value that does not occur in `/api/games.meta` is dimmed (`data-dimmed`, opacity 0.5) but stays
    clickable, so a deep-linked value can be undone.
    - Its tooltip and `aria-description` add "No games", so the state does not rest on opacity alone.
    - A pressed button is never dimmed, so pressed always reads as pressed.
    - Nothing is dimmed while the meta loads.
  - Each button is its own tab stop (MUI `ToggleButtonGroup` has no arrow-key roving), so eight stops sit
    between the selects and the pagination. This is accepted for now.
  - The buttons are 32px square, the height of the count chip and the page buttons.
  - `StatusToggleBar` is the generic bar behind the dialogs' `ProgressToggleBar` too (single mode: exactly
    one value).
  - The watchlist keeps its platform `FilterSelect`, and the dialogs keep `OwnershipSwitch`.
- The MCP tool `search_games` takes the same filters, and its `query` is optional.

## Agent-only extras on `search_games` (MT-013)

- `hasMissing` is a fifth `GameFilters` category (`MissingField`, wire values `description` and `coverImageUrl`,
  the DTO field names rather than `name.lowercase()`) that ORs `IS NULL` checks so an agent can find incomplete
  games. It never reaches REST: `GameFilterParams.kt` does not parse it and `.meta` does not offer it. It needed
  no migration or index.
- `pageSize` (default 10, maximum 100) next to `totalMatches` and `truncated` in the result. That maximum is the
  tool's own ceiling, below the 1..200 that `GET /api/games?pageSize=` accepts.
