package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.requireValid
import kotlin.uuid.Uuid

/*
 * Value objects specific to games; those shared by every media kind (title, release year/date, description,
 * cover image URL, hex color) live in `common/domain/MediaValues.kt`. Every class validates itself in `init`, so
 * an instance can never hold bad data; the API layer simply constructs them from request fields and lets
 * InvalidValueException become a 400.
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

/** Id of a [GameDeveloper]; parsed the same way as [GameId] but named after the request field it comes from. */
@JvmInline
value class GameDeveloperId(val value: Uuid) {
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "developerIds"

        fun new(): GameDeveloperId = GameDeveloperId(Uuid.random())

        fun parse(raw: String): GameDeveloperId = parse(raw, FIELD)

        /** [parse] reporting a malformed [raw] as the request field [field] (e.g. a merge's `targetId`). */
        fun parse(raw: String, field: String): GameDeveloperId =
            GameDeveloperId(Uuid.parseHexDashOrNull(raw) ?: throw InvalidValueException(field, "must be a UUID"))
    }
}
