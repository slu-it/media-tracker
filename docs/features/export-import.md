# Export / Import (MT-023)

ADR: [0027](../decisions/0027-json-backup-per-domain-sources.md). Code: `common/domain/BackupSource.kt`,
`common/persistence/ExposedBackupSource.kt`, `games/persistence/GamesBackupSource.kt`, `backup/domain/BackupService.kt`,
`backup/api/BackupRoutes.kt`, `backupSources` in `Schema.kt`,
`frontend/src/features/settings/components/ExportImportTab.tsx`, `frontend/src/features/settings/api/backupApi.ts`.

- The settings dialog has an **Export / Import** tab. **Export** downloads
  `media-tracker-export-YYYY-MM-DD.json` from `GET /api/backup/export`. **Import** picks a JSON file and posts its
  content unchanged to `POST /api/backup/import`, then shows the inserted and skipped rows per table.
- The dump has one array per table (`game_platforms`, `games`, `game_to_platform`, `game_expansions`), rows keyed
  by DB column name. `users` and `sessions` are never exported.
- The import only inserts rows whose primary key is absent. Nothing is updated or deleted, so re-importing the
  same file skips everything and needs no confirmation. A missing table key counts as empty. An unknown table or
  column, a missing column, a wrongly typed value or a constraint violation is a `400 validation_error`, and
  that source's transaction is rolled back. All sources are validated before any
  of them writes.
- Importing into a non-empty database is supported, but it is row by row. Expansions of a game that already
  exists are appended next to its current ones, which can leave duplicate or gapped `sequence` values.
- A new media kind adds `object <Kind>BackupSource : ExposedBackupSource(listOf(<its tables, parents first>))` in
  its `persistence` package and registers it in `backupSources`. `BackupCoverageTest` fails until it does.
- Planned next step: a daily upload of the same export to Dropbox (`backup/full-export.json`) and a manual
  "back up now" button in this tab.
