-- Flyway migration V010: game release date and developers (MT-025, ADR 0029). Mirrored by
-- de.sluit.mediatracker.games.persistence.{GamesTable.releaseDate, GameDevelopersTable, GameToDeveloperTable}.
--
-- release_date is optional and, when set, overrides release_year (the domain keeps the two in sync on write).
-- game_developers is a vocabulary the user grows on the fly rather than a fixed seed like game_platforms; its
-- name is found by fulltext prefix search like the game title/description (V005), plus a LIKE prefix match for
-- names InnoDB does not index (under three characters, stopwords), and is unique case- and accent-insensitively
-- thanks to the uca1400_ai_ci collation shared by every table here.
ALTER TABLE games ADD COLUMN release_date DATE NULL;

CREATE TABLE game_developers (
    id   CHAR(36)     PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    CONSTRAINT uq_game_developers_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE FULLTEXT INDEX ft_game_developers_name ON game_developers (name);

CREATE TABLE game_to_developer (
    game_id      CHAR(36) NOT NULL,
    developer_id CHAR(36) NOT NULL,
    PRIMARY KEY (game_id, developer_id),
    -- Named indexes before the constraints, so MariaDB reuses them for the FKs instead of adding its own
    -- (SchemaDriftTest compares them with the Kotlin table's indexes).
    INDEX idx_game_to_developer_game (game_id),
    INDEX idx_game_to_developer_developer (developer_id),
    CONSTRAINT fk_game_to_developer_game      FOREIGN KEY (game_id)      REFERENCES games (id)
        ON DELETE CASCADE  ON UPDATE RESTRICT,
    CONSTRAINT fk_game_to_developer_developer FOREIGN KEY (developer_id) REFERENCES game_developers (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
