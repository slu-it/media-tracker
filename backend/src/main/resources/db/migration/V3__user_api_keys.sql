-- Flyway migration V3: per-user API keys. Mirrored by de.sluit.mediatracker.auth.persistence.UsersTable
-- (primaryApiKey, secondaryApiKey).
--
-- Two independent, optional keys per user (primary/secondary) so a key can be rotated without downtime: issue
-- the new one into the unused slot, switch clients over, then regenerate the old slot to revoke it. Stored as
-- the UUID's 36-character hex-dash form, like every other id in this schema (see V2's header comment for why
-- CHAR(36) rather than Exposed's uuid()).

ALTER TABLE users ADD COLUMN primary_api_key CHAR(36) NULL;
ALTER TABLE users ADD COLUMN secondary_api_key CHAR(36) NULL;
ALTER TABLE users ADD CONSTRAINT users_primary_api_key_unique UNIQUE (primary_api_key);
ALTER TABLE users ADD CONSTRAINT users_secondary_api_key_unique UNIQUE (secondary_api_key);
