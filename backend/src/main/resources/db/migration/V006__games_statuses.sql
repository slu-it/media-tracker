-- Flyway migration V006: game status fields (MT-007). Mirrored by
-- de.sluit.mediatracker.games.persistence.GamesTable (ownership, progress, hidden).
--
-- Three non-nullable columns, each backfilled to its domain default and then stripped of that default: the
-- DEFAULT only exists so ALTER TABLE can fill the existing rows without a NULL, but the domain (not the
-- database) owns what a "new" game looks like, and SchemaDriftTest fails if the database has a column default
-- that the Exposed table object does not declare. MariaDB stores BOOLEAN as TINYINT(1).
ALTER TABLE games ADD COLUMN ownership VARCHAR(32) NOT NULL DEFAULT 'watchlist';
ALTER TABLE games ALTER COLUMN ownership DROP DEFAULT;

ALTER TABLE games ADD COLUMN progress VARCHAR(32) NOT NULL DEFAULT 'not_started';
ALTER TABLE games ALTER COLUMN progress DROP DEFAULT;

ALTER TABLE games ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE games ALTER COLUMN hidden DROP DEFAULT;
