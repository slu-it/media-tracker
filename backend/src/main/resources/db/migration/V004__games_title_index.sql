-- Flyway migration V004: index for the title-ordered games listing (MT-003). Mirrored by
-- de.sluit.mediatracker.games.persistence.GamesTable (idx_games_title).
--
-- (title, id) rather than (title) on purpose: V005 adds a FULLTEXT index on title alone, and Exposed's schema drift
-- check (SchemaUtilityApi.filterAndLogExcessIndices) wants to drop one of two indexes over the identical column
-- list. InnoDB appends the primary key to every secondary index anyway, so this is the same physical index as (title).
CREATE INDEX idx_games_title ON games (title, id);
