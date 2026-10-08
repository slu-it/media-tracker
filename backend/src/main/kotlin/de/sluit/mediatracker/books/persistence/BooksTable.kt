package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.common.persistence.localDate
import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.Table

/**
 * Exposed view of the `books` table; the schema itself is db/migration/V012__books.sql (ADR 0034).
 * Registered in [de.sluit.mediatracker.allTables] for the drift check.
 *
 * The id is the UUID in 36-character hex-dash form, like [de.sluit.mediatracker.games.persistence.GamesTable].
 */
object BooksTable : Table("books") {
    val id = char("id", 36)
    val title = varchar("title", 256)
    val releaseYear = integer("release_year")
    val releaseDate = localDate("release_date").nullable()
    val description = text("description").nullable()
    val coverImageUrl = varchar("cover_image_url", 2048).nullable()
    val ownership = varchar("ownership", 32)
    val progress = varchar("progress", 32)

    override val primaryKey = PrimaryKey(id)

    init {
        // Title-ordered listing; (title, id) so it is not an "excess" twin of ft_books_title for the drift check.
        index("idx_books_title", false, title, id)

        // FULLTEXT index for book search, on the title only. The type is never emitted because the index always
        // exists after Flyway and Index.equals ignores indexType.
        index("ft_books_title", false, title, indexType = "FULLTEXT")

        // Filter indexes, mostly for findUsedFilterValues()'s DISTINCT selects.
        index("idx_books_ownership", false, ownership)
        index("idx_books_progress", false, progress)
        index("idx_books_release_year", false, releaseYear)
    }
}

/** Exposed view of the `book_types` table; the four rows seeded by the migration never change ids. */
object BookTypesTable : Table("book_types") {
    val id = char("id", 36)
    val label = varchar("label", 64).uniqueIndex("uq_book_types_label")
    val associatedColor = char("associated_color", 6)

    override val primaryKey = PrimaryKey(id)
}

/** Junction table for the books <-> book_types many-to-many relation; a book may have no rows here. */
object BookToTypeTable : Table("book_to_type") {
    val bookId = char("book_id", 36)
        .references(BooksTable.id, onDelete = ReferenceOption.CASCADE, fkName = "fk_book_to_type_book")
        .index("idx_book_to_type_book")
    val typeId = char("type_id", 36)
        .references(BookTypesTable.id, fkName = "fk_book_to_type_type")
        .index("idx_book_to_type_type")

    override val primaryKey = PrimaryKey(bookId, typeId)
}

/**
 * Exposed view of the `book_authors` table: a vocabulary the user grows on the fly (like
 * [de.sluit.mediatracker.games.persistence.GameDevelopersTable]), no rows are seeded. `uq_book_authors_name`
 * (unique) and `ft_book_authors_name` (fulltext) both index `name` alone but differ in uniqueness, so the drift
 * check does not treat them as duplicates of each other.
 */
object BookAuthorsTable : Table("book_authors") {
    val id = char("id", 36)
    val name = varchar("name", 128).uniqueIndex("uq_book_authors_name")

    override val primaryKey = PrimaryKey(id)

    init {
        index("ft_book_authors_name", false, name, indexType = "FULLTEXT")
    }
}

/** Junction table for the books <-> book_authors many-to-many relation. */
object BookToAuthorTable : Table("book_to_author") {
    val bookId = char("book_id", 36)
        .references(BooksTable.id, onDelete = ReferenceOption.CASCADE, fkName = "fk_book_to_author_book")
        .index("idx_book_to_author_book")
    val authorId = char("author_id", 36)
        .references(BookAuthorsTable.id, fkName = "fk_book_to_author_author")
        .index("idx_book_to_author_author")

    override val primaryKey = PrimaryKey(bookId, authorId)
}
