package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.requireValid
import java.math.BigDecimal
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

/** Id of a [BookNarrator]; parsed the same way as [BookId] but named after the request field it comes from. */
@JvmInline
value class BookNarratorId(val value: Uuid) {
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "narratorIds"

        fun new(): BookNarratorId = BookNarratorId(Uuid.random())

        fun parse(raw: String): BookNarratorId =
            BookNarratorId(Uuid.parseHexDashOrNull(raw) ?: throw InvalidValueException(FIELD, "must be a UUID"))
    }
}

/** Id of a [BookSeries]; parsed the same way as [BookId] but named after the request field it comes from. */
@JvmInline
value class BookSeriesId(val value: Uuid) {
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "series"

        fun new(): BookSeriesId = BookSeriesId(Uuid.random())

        fun parse(raw: String): BookSeriesId =
            BookSeriesId(Uuid.parseHexDashOrNull(raw) ?: throw InvalidValueException(FIELD, "must be a UUID"))
    }
}

/**
 * A book's number within one series (e.g. 1, 2.5 for a novella, 0 for a prequel): at least 0, at most
 * [MAX_VALUE] and with at most [MAX_SCALE] decimal places, matching the `DECIMAL(6,2)` column. The value must be
 * normalised (no trailing zeros; `BigDecimal.equals` also compares the scale), [of] and [fromDouble] normalise
 * for you.
 */
@JvmInline
value class BookSeriesPosition(val value: BigDecimal) {
    init {
        requireValid(FIELD, value.signum() >= 0) { "must not be negative" }
        requireValid(FIELD, value <= MAX_VALUE) { "must be at most $MAX_VALUE" }
        requireValid(FIELD, value.stripTrailingZeros().scale() <= MAX_SCALE) {
            "must have at most $MAX_SCALE decimal places"
        }
        requireValid(FIELD, value == value.normalized()) { "must not have trailing zeros" }
    }

    /** Plain decimal text without trailing zeros, e.g. `2.5`, `1`. */
    override fun toString(): String = value.toPlainString()

    companion object {
        const val FIELD = "series"
        const val MAX_SCALE = 2
        val MAX_VALUE: BigDecimal = BigDecimal("9999.99")

        fun of(raw: BigDecimal): BookSeriesPosition = BookSeriesPosition(raw.normalized())

        /** The wire form is a JSON number; going through its text keeps 2.5 from becoming 2.4999... */
        fun fromDouble(raw: Double): BookSeriesPosition = of(
            try {
                BigDecimal(raw.toString())
            } catch (e: NumberFormatException) {
                throw InvalidValueException(FIELD, "must be a finite number")
            },
        )

        private fun BigDecimal.normalized(): BigDecimal =
            stripTrailingZeros().let { if (it.scale() < 0) it.setScale(0) else it }
    }
}
