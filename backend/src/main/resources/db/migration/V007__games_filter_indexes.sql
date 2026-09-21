-- Flyway migration V007: filter indexes for ownership, progress and release year (game filters, ADR 0021).
-- Mirrored by de.sluit.mediatracker.games.persistence.GamesTable (idx_games_ownership, idx_games_progress,
-- idx_games_release_year).
--
-- Ownership (2 values) and progress (6) are low-cardinality and MariaDB will often ignore these indexes for the
-- list query; they still earn their place because `SELECT DISTINCT <col> FROM games` for the games.meta endpoint
-- becomes an index scan instead of a table scan. No index is added for the platform filter: game_to_platform
-- already carries idx_game_to_platform_platform (V002), which is what the semi-join and the DISTINCT platform
-- query use.
CREATE INDEX idx_games_ownership ON games (ownership);
CREATE INDEX idx_games_progress ON games (progress);
CREATE INDEX idx_games_release_year ON games (release_year);
