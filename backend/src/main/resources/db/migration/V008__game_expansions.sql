-- Flyway migration V008: game expansions (MT-016, ADR 0023). Mirrored by
-- de.sluit.mediatracker.games.persistence.GameExpansionsTable.
--
-- An expansion (DLC) belongs to exactly one game and dies with it (ON DELETE CASCADE). Its title, ownership and
-- progress reuse the game's own domain types, so the column types match games one for one.
--
-- `sequence` carries the owner's manual order, dense and zero-based per game (0..n-1); the service renumbers on
-- every create, move and delete, so ORDER BY sequence is the whole ordering rule. There is deliberately no
-- UNIQUE (game_id, sequence): a reorder rewrites several rows inside one transaction and would collide with such
-- a constraint half-way through. Density is a domain invariant, not a database one (ADR 0023).
--
-- Two indexes: the foreign key column needs its own (repository rule, and the drift test fails without it), and
-- the composite serves the one query that matters, "the expansions of this game in order".
CREATE TABLE game_expansions (
    id        CHAR(36)     PRIMARY KEY,
    game_id   CHAR(36)     NOT NULL,
    sequence  INT          NOT NULL,
    title     VARCHAR(256) NOT NULL,
    ownership VARCHAR(32)  NOT NULL,
    progress  VARCHAR(32)  NOT NULL,
    INDEX idx_game_expansions_game (game_id),
    INDEX idx_game_expansions_game_sequence (game_id, sequence),
    CONSTRAINT fk_game_expansions_game FOREIGN KEY (game_id) REFERENCES games (id)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
