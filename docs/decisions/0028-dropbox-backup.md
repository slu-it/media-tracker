# 0028: Daily backup to Dropbox, connected from the settings dialog

Status: accepted, 2026-09

## Context

Record 0027 added a JSON export and import. A backup that lives only on the Pi's SSD does not survive losing the
Pi, so the export should also go off-site once a day, with a manual trigger next to it. Dropbox offers "apps" with
their own App folder, which is enough storage for this. Dropbox has deprecated long-lived access tokens. A server
without a user present needs the app key and secret plus a refresh token from the OAuth code flow, and uses it to
obtain short-lived access tokens (about 4 h).

## Decision

- **Connect from the settings dialog, using the no-redirect code flow.** "Open Dropbox" opens
  `https://www.dropbox.com/oauth2/authorize?client_id=<key>&response_type=code&token_access_type=offline` in a
  new tab. Dropbox shows a code. The owner pastes it into the Export / Import tab, and the backend exchanges it at
  `/oauth2/token` with HTTP basic auth (key and secret). Without a `redirect_uri`, nothing has to be registered in
  the App Console, the LAN-only host needs no public URL, and there is no callback route or OAuth `state` to
  protect. PKCE is not needed, because the secret never leaves the server.
- **App key and secret are environment variables** (`DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`), optional as a
  pair, as `STEAMGRIDDB_API_KEY` is. Without them the tab shows Dropbox as unavailable, and every Dropbox call is
  `503 dropbox_unavailable`. Exactly one of the two set is a startup error.
- **The refresh token is stored in plaintext** in the system table `oauth_connections` (`provider` primary key,
  one row `dropbox`), for the same reason as the API keys (record 0013). The table is on
  `BackupCoverageTest`'s system list, so the token never appears in an export. Disconnecting revokes the token
  (best effort) and deletes the row. An `invalid_grant` on refresh, meaning the app was removed on the Dropbox
  side, also deletes the row, so the UI falls back to "not connected".
- **`backup` talks to Dropbox only through `CloudStorage`** (`common/domain`: `upload(path, bytes)`,
  `find(path)`). `DropboxService` implements it. The `dropbox` domain knows nothing about backups and can serve
  later uploads.
- **One file, overwritten**: `/backup/full-export.json` in the App folder, the same bytes as the manual download
  (`JsonBackupCodec` encodes both). Dropbox's version history is the rotation, and nothing is cleaned up.
- **The schedule is a coroutine in the `Application` scope**, the Ktor-native way. Ktor has no scheduler plugin,
  and a `launch` in `module()` is cancelled with the application job, so it is safe under auto-reload, like the
  shutdown hooks. It runs daily at `BACKUP_DAILY_AT` (default `03:00`) in `BACKUP_ZONE` (default
  `Europe/Berlin`). The zone is explicit because the distroless image runs in UTC. A restart does not shift the
  slot. The scheduler sleeps in chunks of at most an hour and recomputes from the wall clock, and it never runs
  the slot it just ran a second time. The Pi has no RTC, so an NTP step after boot must not misplace or repeat a run.
- **A failed run is retried once after an hour**, then waits for the next daily slot. "Not connected" is checked
  before the export (`CloudStorage.isConnected()`, no HTTP), logged at info and skipped without a retry.
- **The last backup is read live from Dropbox** (`files/get_metadata`: `server_modified`, `size`), not stored
  locally. It survives restarts and shows the real state.
- **Required App Console setup**: scoped access, App folder, and the permissions `files.content.write` and
  `files.metadata.read`, set before connecting.

## Alternatives not taken

- **A refresh token in the environment**, obtained once by hand with `curl`: simpler code, but a manual setup
  step outside the app. The owner preferred connecting in the UI.
- **The App Console's "Generated access token"**: since Dropbox retired long-lived tokens on 2021-09-30, the
  button only issues short-lived tokens (prefix `sl.`, about 4 h). The console no longer offers a "No
  expiration" option, so a server without a user present needs a refresh token.
- **The redirect code flow with a callback route**: this needs a registered redirect URI, HTTPS and a URL
  Dropbox's redirect can reach from the browser, plus `state` handling. It adds nothing for a single-owner
  installation.
- **Every 24 h after startup**: the run time would drift with every deploy.
- **Recording the last run in the database**: a status Dropbox already has would be duplicated, and it could
  claim a backup that Dropbox no longer holds.

## Consequences

- Anyone who can read the database can use the Dropbox token, but only on the app's own folder.
- A scheduled failure is visible only in the log and in a stale "last backup" date in the tab.
- Development runs with the two variables set upload to the real App folder. `local-env.sh` does not set them.
