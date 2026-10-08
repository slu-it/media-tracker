-- Flyway migration V012: books (ADR 0034). Mirrored by de.sluit.mediatracker.books.persistence.{BooksTable,
-- BookTypesTable, BookToTypeTable, BookAuthorsTable, BookToAuthorTable}.
--
-- Books reuse the building blocks of games: title, release year with an optional release date that overrides it
-- (ADR 0029), description and cover image URL. book_types is seeded reference data like game_platforms (ADR 0009),
-- but a book may have no type at all; book_authors is a vocabulary the user grows on the fly like game_developers
-- (V010). ownership and progress are closed value sets stored as wire values (ADR 0017); there are no column
-- defaults, the domain owns them. Single-user application: rows are not scoped to a user.

CREATE TABLE book_types (
    id               CHAR(36)    PRIMARY KEY,
    label            VARCHAR(64) NOT NULL,
    associated_color CHAR(6)     NOT NULL, -- RRGGBB hex, no '#'
    CONSTRAINT uq_book_types_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE books (
    id              CHAR(36)      PRIMARY KEY,
    title           VARCHAR(256)  NOT NULL,
    release_year    INT           NOT NULL,
    release_date    DATE          NULL, -- when set, release_year equals its year (kept in sync by the domain)
    description     TEXT          NULL, -- at most 10000 characters, enforced by the domain
    cover_image_url VARCHAR(2048) NULL,
    ownership       VARCHAR(32)   NOT NULL,
    progress        VARCHAR(32)   NOT NULL,
    INDEX idx_books_title (title, id),
    INDEX idx_books_ownership (ownership),
    INDEX idx_books_progress (progress),
    INDEX idx_books_release_year (release_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE FULLTEXT INDEX ft_books_title ON books (title);

CREATE TABLE book_to_type (
    book_id CHAR(36) NOT NULL,
    type_id CHAR(36) NOT NULL,
    PRIMARY KEY (book_id, type_id),
    -- Named indexes before the constraints, so MariaDB reuses them for the FKs instead of adding its own
    -- (SchemaDriftTest compares them with the Kotlin table's indexes).
    INDEX idx_book_to_type_book (book_id),
    INDEX idx_book_to_type_type (type_id),
    CONSTRAINT fk_book_to_type_book FOREIGN KEY (book_id) REFERENCES books (id)
        ON DELETE CASCADE  ON UPDATE RESTRICT,
    CONSTRAINT fk_book_to_type_type FOREIGN KEY (type_id) REFERENCES book_types (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE book_authors (
    id   CHAR(36)     PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    CONSTRAINT uq_book_authors_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE FULLTEXT INDEX ft_book_authors_name ON book_authors (name);

CREATE TABLE book_to_author (
    book_id   CHAR(36) NOT NULL,
    author_id CHAR(36) NOT NULL,
    PRIMARY KEY (book_id, author_id),
    INDEX idx_book_to_author_book (book_id),
    INDEX idx_book_to_author_author (author_id),
    CONSTRAINT fk_book_to_author_book   FOREIGN KEY (book_id)   REFERENCES books (id)
        ON DELETE CASCADE  ON UPDATE RESTRICT,
    CONSTRAINT fk_book_to_author_author FOREIGN KEY (author_id) REFERENCES book_authors (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Seed: the book types the UI offers, with fixed ids so fixtures and environments agree.
INSERT INTO book_types (id, label, associated_color) VALUES
    ('6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0001', 'Hardcover', '5D4037'),
    ('6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0002', 'Paperback', '00796B'),
    ('6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0003', 'Kindle',    '1A73B5'),
    ('6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0004', 'Audible',   'F7991C');
