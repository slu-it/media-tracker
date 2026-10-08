-- Flyway migration V011: drop the FULLTEXT index on games.description (MT-040, ADR 0033).
-- Mirrored by de.sluit.mediatracker.games.persistence.GamesTable.
--
-- The game search now matches the title only: description hits were noise. The new `title LIKE 'term%'` prefix
-- match for titles InnoDB does not index (under three characters, stopwords) needs no new index: ft_games_title
-- (V005) stays for the fulltext half, and the OR'd LIKE is evaluated per row, which is fine for a single owner's
-- library.
ALTER TABLE games DROP INDEX ft_games_description;
