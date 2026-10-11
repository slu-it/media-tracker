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

/** Human-readable name of a book type, e.g. "Hardcover". Trimmed before construction by [parse]. */
@JvmInline
value class BookTypeLabel(val value: String) {
    init {
        requireValid(FIELD, value.isNotBlank()) { "must not be blank" }
        requireValid(FIELD, value == value.trim()) { "must not have surrounding whitespace" }
        requireValid(FIELD, value.length <= MAX_LENGTH) { "must be at most $MAX_LENGTH characters" }
    }

    override fun toString(): String = value

    companion object {
        const val FIELD = "label"
        const val MAX_LENGTH = 64

        /** Trims [raw] before validating, so callers never have to trim by hand. */
        fun parse(raw: String): BookTypeLabel = BookTypeLabel(raw.trim())
    }
}

/** Id of a [BookAuthor]; parsed the same way as [BookId] but named after the request field it comes from. */
@JvmInline
value class BookAuthorId(val value: Uuid) {
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "authorIds"

        fun new(): BookAuthorId = BookAuthorId(Uuid.random())

        fun parse(raw: String): BookAuthorId = parse(raw, FIELD)

        /** [parse] reporting a malformed [raw] as the request field [field] (e.g. a merge's `targetId`). */
        fun parse(raw: String, field: String): BookAuthorId =
            BookAuthorId(Uuid.parseHexDashOrNull(raw) ?: throw InvalidValueException(field, "must be a UUID"))
    }
}

/** Id of a [BookNarrator]; parsed the same way as [BookId] but named after the request field it comes from. */
@JvmInline
value class BookNarratorId(val value: Uuid) {
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "narratorIds"

        fun new(): BookNarratorId = BookNarratorId(Uuid.random())

        fun parse(raw: String): BookNarratorId = parse(raw, FIELD)

        /** [parse] reporting a malformed [raw] as the request field [field] (e.g. a merge's `targetId`). */
        fun parse(raw: String, field: String): BookNarratorId =
            BookNarratorId(Uuid.parseHexDashOrNull(raw) ?: throw InvalidValueException(field, "must be a UUID"))
    }
}

/** Id of a [BookSeries]; parsed the same way as [BookId] but named after the request field it comes from. */
@JvmInline
value class BookSeriesId(val value: Uuid) {
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "series"

        fun new(): BookSeriesId = BookSeriesId(Uuid.random())

        fun parse(raw: String): BookSeriesId = parse(raw, FIELD)

        /** [parse] reporting a malformed [raw] as the request field [field] (e.g. a merge's `targetId`). */
        fun parse(raw: String, field: String): BookSeriesId =
            BookSeriesId(Uuid.parseHexDashOrNull(raw) ?: throw InvalidValueException(field, "must be a UUID"))
    }
}
