package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.requireValid
import java.net.URI
import java.net.URISyntaxException
import kotlin.uuid.Uuid

/*
 * Value objects of the games domain. Every class validates itself in `init`, so an instance can never hold
 * bad data; the API layer simply constructs them from request fields and lets InvalidValueException become a
 * 400. This file is the template for the value objects of future media kinds.
 */

@JvmInline
value class GameId(val value: Uuid) {
    /** 36-character hex-dash form, the same string that is stored in the CHAR(36) column. */
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "id"

        fun new(): GameId = GameId(Uuid.random())

        fun parse(raw: String): GameId =
            GameId(Uuid.parseHexDashOrNull(raw) ?: throw InvalidValueException(FIELD, "must be a UUID"))
    }
}

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
    }
}

/** Free-form text about a game. Optional on a game, but never blank or overly long when present. */
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

/** A star rating between 0.25 and 5.0, in quarter-star steps. */
@JvmInline
value class Rating(val value: Double) {
    init {
        requireValid(FIELD, value.isFinite()) { "must be a number" }
        requireValid(FIELD, value in MIN..MAX) { "must be between $MIN and $MAX" }
        requireValid(FIELD, (value * 4) % 1.0 == 0.0) { "must be a multiple of 0.25" }
    }

    companion object {
        const val FIELD = "rating"
        const val MIN = 0.25
        const val MAX = 5.0
    }
}

/** Id of a [GamePlatform]; parsed the same way as [GameId] but named after the request field it comes from. */
@JvmInline
value class GamePlatformId(val value: Uuid) {
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "platformIds"

        fun parse(raw: String): GamePlatformId =
            GamePlatformId(Uuid.parseHexDashOrNull(raw) ?: throw InvalidValueException(FIELD, "must be a UUID"))
    }
}

/** Human-readable name of a platform, e.g. "PlayStation". */
@JvmInline
value class PlatformLabel(val value: String) {
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

/** RRGGBB hex color (no leading '#') used to render a platform's badge. */
@JvmInline
value class HexColor(val value: String) {
    init {
        requireValid(FIELD, PATTERN.matches(value)) { "must be a 6-digit hex color without '#'" }
    }

    override fun toString(): String = value

    companion object {
        const val FIELD = "associatedColor"
        private val PATTERN = Regex("^[0-9A-Fa-f]{6}$")
    }
}

/** Absolute http(s) URL of a cover image. Optional on a game, but never blank or malformed when present. */
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
