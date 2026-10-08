-- Flyway migration V013: book narrators and book series (MT-042). Mirrored by
-- de.sluit.mediatracker.books.persistence.{BookNarratorsTable, BookToNarratorTable, BookSeriesTable,
-- BookToSeriesTable}.
--
-- Narrators work exactly like book_authors (V012): a vocabulary the user grows on the fly, linked many-to-many.
-- Series are the same kind of vocabulary, but each book-to-series link carries the book's optional number in
-- that series (position, NULL = no number): at least 0, at most 9999.99, two decimals, enforced by the domain.

CREATE TABLE book_narrators (
    id   CHAR(36)     PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    CONSTRAINT uq_book_narrators_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE FULLTEXT INDEX ft_book_narrators_name ON book_narrators (name);

CREATE TABLE book_to_narrator (
    book_id     CHAR(36) NOT NULL,
    narrator_id CHAR(36) NOT NULL,
    PRIMARY KEY (book_id, narrator_id),
    INDEX idx_book_to_narrator_book (book_id),
    INDEX idx_book_to_narrator_narrator (narrator_id),
    CONSTRAINT fk_book_to_narrator_book     FOREIGN KEY (book_id)     REFERENCES books (id)
        ON DELETE CASCADE  ON UPDATE RESTRICT,
    CONSTRAINT fk_book_to_narrator_narrator FOREIGN KEY (narrator_id) REFERENCES book_narrators (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE book_series (
    id   CHAR(36)     PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    CONSTRAINT uq_book_series_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE FULLTEXT INDEX ft_book_series_name ON book_series (name);

CREATE TABLE book_to_series (
    book_id   CHAR(36)     NOT NULL,
    series_id CHAR(36)     NOT NULL,
    position  DECIMAL(6,2) NULL,
    PRIMARY KEY (book_id, series_id),
    INDEX idx_book_to_series_book (book_id),
    INDEX idx_book_to_series_series (series_id),
    CONSTRAINT fk_book_to_series_book   FOREIGN KEY (book_id)   REFERENCES books (id)
        ON DELETE CASCADE  ON UPDATE RESTRICT,
    CONSTRAINT fk_book_to_series_series FOREIGN KEY (series_id) REFERENCES book_series (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
