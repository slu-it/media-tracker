-- Flyway migration V001: users and sessions.
--
-- Conventions (see docs/architecture.md, "Schema migrations"):
--   * files are named V<nnn>__<snake_case>.sql and never edited once applied anywhere;
--   * scripts must run on MariaDB 11.8 and on H2 in MariaDB mode (used by the tests);
--   * ${timestamp_type} is a Flyway placeholder: DATETIME(6) on MariaDB, TIMESTAMP(9) on H2, because Exposed
--     expects different column types per engine and the drift test compares them on H2;
--   * the Kotlin table objects in de.sluit.mediatracker.db.Tables must match this schema exactly
--     (columns, types, nullability, indexes, foreign keys); SchemaDriftTest enforces it.

CREATE TABLE users (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(64)       NOT NULL,
    password_hash VARCHAR(255)      NOT NULL,
    created_at    ${timestamp_type} NOT NULL,
    CONSTRAINT users_username_unique UNIQUE (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE sessions (
    id         VARCHAR(64)       PRIMARY KEY,
    user_id    BIGINT            NOT NULL,
    created_at ${timestamp_type} NOT NULL,
    expires_at ${timestamp_type} NOT NULL,
    INDEX sessions_user_id (user_id),
    INDEX sessions_expires_at (expires_at),
    CONSTRAINT fk_sessions_user_id__id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
