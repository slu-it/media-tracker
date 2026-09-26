# Dropbox backup (MT-024)

ADR: [0028](../decisions/0028-dropbox-backup.md), building on [export and import](export-import.md) (0027).
Code: `common/domain/CloudStorage.kt`, `dropbox/` (domain `DropboxService`, integration `DropboxHttpApi`,
persistence `OAuthConnectionsTable`, api `DropboxRoutes`), `backup/domain/CloudBackupService.kt`,
`backup/api/BackupScheduler.kt`, `backup/api/JsonBackupCodec.kt`,
`frontend/src/features/settings/components/DropboxBackupSection.tsx`. Setup steps: README, "Dropbox backup".

- **Availability**: `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET` set as a pair. Without them `GET /api/dropbox`
  answers `available: false` and the tab shows a hint.
- **Connecting**:
  1. While not connected, the tab loads `GET /api/dropbox/authorize-url` up front, and "Open Dropbox" is a
     plain link to it (`target="_blank"`, `rel="noopener noreferrer"`). Opening it after an awaited fetch would be
     blocked as a popup by Safari.
  2. Dropbox shows a code after the owner allows access.
  3. The owner pastes it, and `POST /api/dropbox/connection {code}` exchanges it for a refresh token, stored in
     the system table `oauth_connections`.

  A rejected or malformed code is a `400 validation_error`. `DELETE /api/dropbox/connection` revokes (best
  effort) and deletes it.
- **Tokens**: `DropboxService` caches the short-lived access token and refreshes it 5 minutes before it expires,
  retrying once on a 401. An `invalid_grant` (the app was removed in Dropbox) deletes the connection.
- **Backup**: `CloudBackupService.backupNow()` uploads the export bytes, identical to the download, to
  `/backup/full-export.json` in the App folder with `mode: overwrite`. `POST /api/backup/dropbox` triggers it.
  `GET /api/backup/dropbox` returns `{lastBackup: {modifiedAt, sizeBytes} | null}`, read from Dropbox's
  metadata. Not connected or not configured is `503 dropbox_unavailable`, and a Dropbox failure is
  `502 dropbox_error`. On a 503 the tab re-reads `GET /api/dropbox` and falls back to "not connected" with a
  translated notice.
- **Schedule**: `BackupScheduler` runs in the application's coroutine scope. It runs daily at `BACKUP_DAILY_AT`
  (default `03:00`) in `BACKUP_ZONE` (default `Europe/Berlin`), with the slot computed DST-correct from the
  clock each day.
  - It sleeps in chunks of at most 1 h and re-reads the wall clock after each. It remembers the last slot it ran,
    so an NTP step on the RTC-less Pi can neither misplace a run nor repeat the slot it just ran.
  - Before exporting it checks `CloudStorage.isConnected()`, a DB lookup with no HTTP. When that is false the
    slot is skipped, logged at info, with no export and no retry.
  - A failure is logged at error and retried once after 1 h.
- The refresh token never appears in an export (`BackupCoverageTest` lists `oauth_connections` as a system table),
  and neither the token nor the app secret appears in exceptions or logs.
