-- Flyway migration V009: OAuth connections to outward providers (MT-024, ADR 0028). Mirrored by
-- de.sluit.mediatracker.dropbox.persistence.OAuthConnectionsTable.
--
-- Generic per provider; the one row today is 'dropbox'. The refresh token is stored in plaintext, consistent
-- with the per-user API keys (V003, ADR 0013): both are server-held bearer credentials the app must be able to
-- present again unattended, not a user's own secret, so there is nothing more to protect them with than the
-- database itself. A system table like `users`/`sessions`: BackupCoverageTest names it explicitly so the token
-- is never exported.
CREATE TABLE oauth_connections (
    provider      VARCHAR(32)  PRIMARY KEY,
    refresh_token VARCHAR(512) NOT NULL,
    connected_at  DATETIME(6)  NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
