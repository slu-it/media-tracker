# Game series

ADRs: [0044](../decisions/0044-game-series-and-shared-series-building-blocks.md) (game series, shared series code),
which applies [0035](../decisions/0035-book-series-and-narrators.md),
[0041](../decisions/0041-rename-merge-and-delete-book-authors-and-series.md) and
[0042](../decisions/0042-narrators-and-developers-views-and-shared-group-view.md) to games.

Game series behave exactly like [book series](books.md). This page lists what is specific to games. For the
behaviour itself, read the books page.

Code:
- Backend:
  - Domain: `games/domain` (`GameSeriesId`, `GameSeries`, `GameSeriesEntry`, `GameSeriesSummary`, `GameSeriesRepository`, `GameSeriesService`, `GameService.resolveSeries`/`listBySeries`).
  - Persistence: `games/persistence` (`GameSeriesTable`, `GameToSeriesTable`, `ExposedGameSeriesRepository`, `ExposedGameRepository.seriesFor`/`findBySeries`).
  - API: `games/api` (`/game-series` routes in `GameRoutes.kt`, DTOs in `GameDtos.kt`, MCP tools in `GameMcpTools.kt`).
  - Migration: `V014__game_series.sql`.
  - Shared with books: `common/domain/SeriesPosition.kt` and the position-aware merge in `common/persistence`.
- Frontend:
  - Games: `features/games/GamesSeriesView.tsx`, `hooks/useGameGroupLabels.ts`, the series functions in `api/gamesApi.ts`, and the series drafts in `domain/gameDraft.ts`. `GameCard`, `GameForm`, `GameDetails`, `AddGameDialog` and `GameDetailDialog` are touched.
  - Shared with books: `domain/media/seriesLabel.ts` (`primarySeries`, `formatSeriesEntry`), `domain/media/seriesDraft.ts` (`resolveSeriesLinks`), the position validator in `domain/media/values.ts`, and `components/media/fields/SeriesField.tsx` and `SeriesPositionField.tsx`. Shared texts live under `media.series.*`.

## Data

- **Vocabulary:** `game_series` is user-created vocabulary with an idempotent, case- and accent-insensitive create and a prefix fulltext lookup. Orphans are kept.
- **Links:** `game_to_series` carries `position DECIMAL(6,2) NULL` (`SeriesPosition`: 0 to 9999.99, at most two decimals). A game is in a series at most once and may be in several.
- **Delete rules:** deleting a game cascades its links. A series that is still used cannot be deleted (`RESTRICT`).
- **Order:** a game's series are ordered by name.
- **Backup:** both tables are in `GamesBackupSource`.

## REST and MCP

| Endpoint | Behaviour |
|---|---|
| `POST /api/games`, `PATCH /api/games/{id}` | `series` (`[{seriesId, position?}]`) is optional. An update replaces the set, and an empty list clears it. A repeated or unknown `seriesId` is a 400. |
| `GET`/`POST /api/game-series` | Same as `/api/game-developers`. `GameResponse.series` is `[{id, name, position}]`. |
| `GET /api/game-series.summaries` | Every series as `[{id, name, gameCount}]`, by name, including series without games. |
| `GET /api/game-series/{id}/games` | The series' games: by position (unnumbered last), then title. 404 for an unknown series. |
| `PATCH`, `POST .../merge`, `DELETE /api/game-series/{id}` | As for book series. A game in both series keeps the target's position, or the merged series' position when the target has none. Delete only works while no game uses the series. |

MCP tools:
- `search_game_series` and `create_game_series` look up and create series.
- `add_game` and `update_game` take `series` (`[{seriesId, position?}]`, replaced as a whole on update).

## UI

- **Form:** `SeriesField` sits after the developers. Each selected series gets one number input below the chips. New series names are created on save, before the game.
- **Detail view:** shows all series as unlabelled chips ("Hades #2"), in a group named "Series".
- **Overview and developer cards:** `GameCard` without `seriesPosition` shows the primary series (`primarySeries`: lowest position, unnumbered after every number, ties by name and then id) as an outlined chip above the platform chips. A game without series keeps that row's height empty, so covers line up across a grid row. Watchlist and ranking cards show no series.
- **Series view** at `/games/series`:
  - Tab label "Game series" / "Spielreihen" (`subPages.pages.gameSeries`, via `subPageLabelKey` in `App.tsx`), icon `CollectionsBookmarkOutlined`.
  - It is the shared `MediaGroupsView` over the summaries, with search and `sort=volume` ("Most games").
  - An expanded series shows its games in series order. Each card has a filled "#n" badge above the cover, or an invisible placeholder when the game has no number.
  - Rename, merge and delete work as in the developers view. Texts live under `games.seriesView`.
