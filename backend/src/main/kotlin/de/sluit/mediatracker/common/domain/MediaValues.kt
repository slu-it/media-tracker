package de.sluit.mediatracker.common.domain

import java.net.URI
import java.net.URISyntaxException
import java.time.LocalDate
import java.time.format.DateTimeParseException

/*
 * Value objects shared by every media kind. Every class validates itself in `init`, so an instance can never
 * hold bad data; the API layer simply constructs them from request fields and lets InvalidValueException
 * become a 400.
 */

@JvmInline
value class Title(val value: String) {
    init {
        requireValid(FIELD, value.isNotBlank()) { "must not be blank" }
        requireValid(FIELD, value.length <= MAX_LENGTH) { "must be at most $MAX_LENGTH characters" }
    }

    override fun toString(): String = value

    companion object {
        const val FIELD = "title"
        const val MAX_LENGTH = 256
    }
}

/** A four-digit year. The UI narrows the range further; the domain only guarantees the shape. */
@JvmInline
value class ReleaseYear(val value: Int) {
    init {
        requireValid(FIELD, value in MIN..MAX) { "must be a four-digit year ($MIN-$MAX)" }
    }

    companion object {
        const val FIELD = "releaseYear"
        const val MIN = 1000
        const val MAX = 9999

        /** Parses a raw query-parameter value; a non-integer raises [InvalidValueException] naming [FIELD]. */
        fun parse(raw: String): ReleaseYear =
            ReleaseYear(raw.toIntOrNull() ?: throw InvalidValueException(FIELD, "must be an integer"))
    }
}

/** Free-form text about an item. Optional on an item, but never blank or overly long when present. */
@JvmInline
value class Description(val value: String) {
    init {
        requireValid(FIELD, value.isNotBlank()) { "must not be blank" }
        requireValid(FIELD, value.length <= MAX_LENGTH) { "must be at most $MAX_LENGTH characters" }
    }

    override fun toString(): String = value

    companion object {
        const val FIELD = "description"
        const val MAX_LENGTH = 10000
    }
}

/** RRGGBB hex color (no leading '#') used to render a badge, e.g. a game platform's. */
@JvmInline
value class HexColor(val value: String) {
    init {
        requireValid(FIELD, PATTERN.matches(value)) { "must be a 6-digit hex color without '#'" }
    }

    override fun toString(): String = value

    companion object {
        const val FIELD = "associatedColor"
        private val PATTERN = Regex("^[0-9A-Fa-f]{6}$")

        /** Uppercases [raw] before validating, so the stored form is canonical whatever the client sent. */
        fun parse(raw: String): HexColor = HexColor(raw.uppercase())
    }
}

/** Absolute http(s) URL of a cover image. Optional on an item, but never blank or malformed when present. */
@JvmInline
value class CoverImageUrl(val value: String) {
    init {
        requireValid(FIELD, value.isNotBlank()) { "must not be blank" }
        requireValid(FIELD, value.length <= MAX_LENGTH) { "must be at most $MAX_LENGTH characters" }
        val uri = try {
            URI(value)
        } catch (_: URISyntaxException) {
            null
        }
        requireValid(FIELD, uri != null && uri.isAbsolute && uri.host != null && uri.scheme.lowercase() in SCHEMES) {
            "must be an absolute http(s) URL"
        }
    }

    override fun toString(): String = value

    companion object {
        const val FIELD = "coverImageUrl"
        const val MAX_LENGTH = 2048
        private val SCHEMES = setOf("http", "https")
    }
}

/**
 * An item's precise release date (MT-025, ADR 0029). When set, it overrides [ReleaseYear]: the release year an
 * item stores is kept equal to [year] (see `ReleaseDating.kt`) rather than storing two independent facts.
 */
@JvmInline
value class ReleaseDate(val value: LocalDate) {
    init {
        requireValid(FIELD, value.year in ReleaseYear.MIN..ReleaseYear.MAX) {
            "year must be a four-digit year (${ReleaseYear.MIN}-${ReleaseYear.MAX})"
        }
    }

    val year: Int get() = value.year

    /** ISO-8601 `YYYY-MM-DD`, the same form [parse] accepts and the wire representation uses. */
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "releaseDate"

        fun parse(raw: String): ReleaseDate {
            val parsed = try {
                LocalDate.parse(raw)
            } catch (_: DateTimeParseException) {
                throw InvalidValueException(FIELD, "must be an ISO date (YYYY-MM-DD)")
            }
            return ReleaseDate(parsed)
        }
    }
}
