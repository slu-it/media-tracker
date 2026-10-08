package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.requireValid
import kotlin.uuid.Uuid

/*
 * Value objects specific to books; those shared by every media kind (title, release year/date, description,
 * cover image URL, hex color, vocabulary name) live in `common/domain`. Every class validates itself in `init`,
 * so an instance can never hold bad data; the API layer simply constructs them from request fields and lets
 * InvalidValueException become a 400.
 */

@JvmInline
value class BookId(val value: Uuid) {
    /** 36-character hex-dash form, the same string that is stored in the CHAR(36) column. */
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "id"

        fun new(): BookId = BookId(Uuid.random())

        fun parse(raw: String): BookId =
            BookId(Uuid.parseHexDashOrNull(raw) ?: throw InvalidValueException(FIELD, "must be a UUID"))
    }
}

/** Id of a [BookType]; parsed the same way as [BookId] but named after the request field it comes from. */
@JvmInline
value class BookTypeId(val value: Uuid) {
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "typeIds"

        fun parse(raw: String): BookTypeId =
            BookTypeId(Uuid.parseHexDashOrNull(raw) ?: throw InvalidValueException(FIELD, "must be a UUID"))
    }
}

/** Human-readable name of a book type, e.g. "Hardcover". */
@JvmInline
value class BookTypeLabel(val value: String) {
    init {
        requireValid(FIELD, value.isNotBlank()) { "must not be blank" }
        requireValid(FIELD, value.length <= MAX_LENGTH) { "must be at most $MAX_LENGTH characters" }
    }

    override fun toString(): String = value

    companion object {
        const val FIELD = "label"
        const val MAX_LENGTH = 64
    }
}

/** Id of a [BookAuthor]; parsed the same way as [BookId] but named after the request field it comes from. */
@JvmInline
value class BookAuthorId(val value: Uuid) {
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "authorIds"

        fun new(): BookAuthorId = BookAuthorId(Uuid.random())

        fun parse(raw: String): BookAuthorId =
            BookAuthorId(Uuid.parseHexDashOrNull(raw) ?: throw InvalidValueException(FIELD, "must be a UUID"))
    }
}
