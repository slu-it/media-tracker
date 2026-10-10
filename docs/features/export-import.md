# Export / Import (MT-023)

ADR: [0027](../decisions/0027-json-backup-per-domain-sources.md). Code: `common/domain/BackupSource.kt`,
`common/persistence/ExposedBackupSource.kt`, `games/persistence/GamesBackupSource.kt`, `books/persistence/BooksBackupSource.kt`, `backup/domain/BackupService.kt`,
`backup/api/BackupRoutes.kt`, `backupSources` in `Schema.kt`,
`frontend/src/features/settings/components/ExportImportTab.tsx`, `frontend/src/features/settings/api/backupApi.ts`.

- The settings dialog has an **Export / Import** tab. **Export** downloads
  `media-tracker-export-YYYY-MM-DD.json` from `GET /api/backup/export`. **Import** picks a JSON file and posts its
  content unchanged to `POST /api/backup/import`, then shows the inserted, updated and skipped rows per table.
- The dump has one array per table (for example `game_platforms`, `games`, `game_to_platform`, `game_expansions`), rows keyed
  by DB column name. The system tables `users`, `sessions` and `oauth_connections` are never
  exported.
- The import only inserts rows whose primary key is absent. Nothing is deleted, and nothing is updated except in the
  two editable reference tables `book_types` and `game_platforms` (ADR [0043](../decisions/0043-editable-book-types-and-game-platforms.md)): there a row whose id exists gets the label and colour
  from the file when they differ, so a restore brings back renamed or recoloured entries. Each row counts once per table, as
  `inserted`, `updated` or `skipped` (id exists, nothing changed). Labels and colours of these tables must follow the API's
  rules (trimmed, 1 to 64 characters, six hex digits; colours are stored uppercase). The updates run in two phases
  (changed labels first get a placeholder), so swapped or chained renames import; a label held by a row the file does not
  update is a constraint violation (below). Re-importing the same file skips everything and needs no confirmation, but
  restoring an older file also resets later name and colour edits of those two tables to the file's values. A missing table key counts as empty. An unknown table or
  column, a missing non-nullable column, a wrongly typed value or a constraint violation is a `400 validation_error`, and
  that source's transaction is rolled back. All sources are validated before any
  of them writes. A missing nullable column imports as `null`, so older exports survive a new optional
  column (MT-025, `games.release_date`). `DATE` columns travel as ISO `YYYY-MM-DD` strings. `DECIMAL` columns travel as JSON numbers (MT-042, `book_to_series.position`); a value beyond
  the column's precision or scale is a 400.
- Importing into a non-empty database is supported, but it is row by row. Expansions of a game that already
  exists are appended next to its current ones, which can leave duplicate or gapped `sequence` values.
- A new media kind adds `object <Kind>BackupSource : ExposedBackupSource(listOf(<its tables, parents first>))` in
  its `persistence` package and registers it in `backupSources`. `BackupCoverageTest` fails until it does.
- The same export also goes to Dropbox, daily and on demand: see [Dropbox backup](dropbox-backup.md).
