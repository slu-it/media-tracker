CREATE TABLE game_series (
    id   CHAR(36)     PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    CONSTRAINT uq_game_series_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE FULLTEXT INDEX ft_game_series_name ON game_series (name);

CREATE TABLE game_to_series (
    game_id   CHAR(36)     NOT NULL,
    series_id CHAR(36)     NOT NULL,
    position  DECIMAL(6,2) NULL,
    PRIMARY KEY (game_id, series_id),
    INDEX idx_game_to_series_game (game_id),
    INDEX idx_game_to_series_series (series_id),
    CONSTRAINT fk_game_to_series_game   FOREIGN KEY (game_id)   REFERENCES games (id)
        ON DELETE CASCADE  ON UPDATE RESTRICT,
    CONSTRAINT fk_game_to_series_series FOREIGN KEY (series_id) REFERENCES game_series (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
