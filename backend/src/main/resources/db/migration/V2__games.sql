-- Flyway migration V2: games (MT-001). Mirrored by de.sluit.mediatracker.games.persistence.{GamesTable,
-- GamePlatformsTable, GameToPlatformTable}.
--
-- Amended in place before the first release (ADR 0009): MT-001 was still unmerged and no database that survives
-- had run this script, so platforms moved from a single enum column to a many-to-many relation
-- (game_platforms / game_to_platform) and games gained an optional description and rating. Do not amend this
-- script again once it has shipped; add a new V<n> instead.
--
-- id columns hold the UUID in its 36-character hex-dash form. Exposed's uuid() column would be BINARY(16) on
-- MySQL but UUID on H2 and fail SchemaDriftTest; CHAR(36) is identical on both engines and readable in SQL
-- tools. Single-user application: rows are not scoped to a user.

CREATE TABLE game_platforms (
    id               CHAR(36)    PRIMARY KEY,
    label            VARCHAR(64) NOT NULL,
    associated_color CHAR(6)     NOT NULL, -- RRGGBB hex, no '#'
    CONSTRAINT uq_game_platforms_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE games (
    id              CHAR(36)      PRIMARY KEY,
    title           VARCHAR(256)  NOT NULL,
    release_year    INT           NOT NULL,
    description     TEXT          NULL, -- at most 10000 characters, enforced by the domain
    rating          DOUBLE        NULL, -- 0.25..5.00 in quarter steps, enforced by the domain
    cover_image_url VARCHAR(2048) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE game_to_platform (
    game_id     CHAR(36) NOT NULL,
    platform_id CHAR(36) NOT NULL,
    PRIMARY KEY (game_id, platform_id),
    -- Indexes before the constraints, so H2 does not add its own FK index (SchemaDriftTest would flag it).
    INDEX idx_game_to_platform_game (game_id),
    INDEX idx_game_to_platform_platform (platform_id),
    CONSTRAINT fk_game_to_platform_game     FOREIGN KEY (game_id)     REFERENCES games (id)
        ON DELETE CASCADE  ON UPDATE RESTRICT,
    CONSTRAINT fk_game_to_platform_platform FOREIGN KEY (platform_id) REFERENCES game_platforms (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seed: the former Platform enum constants, with fixed ids so fixtures and environments agree.
INSERT INTO game_platforms (id, label, associated_color) VALUES
    ('0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d0001', 'PC',          '757575'),
    ('0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d0002', 'PlayStation', '0070D1'),
    ('0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d0003', 'Xbox',        '107C10'),
    ('0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d0004', 'Nintendo',    'E60012');
