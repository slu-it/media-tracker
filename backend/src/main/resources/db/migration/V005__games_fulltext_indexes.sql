-- Flyway migration V005: InnoDB FULLTEXT indexes for the game search (MT-003, ADR 0015). Mirrored by
-- de.sluit.mediatracker.games.persistence.GamesTable (ft_games_title, ft_games_description).
--
-- Two separate indexes because the search scores MATCH(title) and MATCH(description) independently
-- (2 * title + 0.75 * description) and orders by that score. Queries run in BOOLEAN MODE with a prefix wildcard
-- per word, so InnoDB's default innodb_ft_min_token_size (3) and stopword list apply to the indexed words only.
CREATE FULLTEXT INDEX ft_games_title ON games (title);
CREATE FULLTEXT INDEX ft_games_description ON games (description);
