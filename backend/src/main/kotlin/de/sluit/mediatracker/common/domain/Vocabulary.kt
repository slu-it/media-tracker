package de.sluit.mediatracker.common.domain

/*
 * Building blocks of a user-grown vocabulary (MT-025, ADR 0029), e.g. a game's developers: named entries that
 * are searched by prefix and created on the fly.
 */

/** Human-readable name of a vocabulary entry, e.g. "Nintendo EPD". Trimmed before construction by [parse]. */
@JvmInline
value class VocabularyName(val value: String) {
    init {
        requireValid(FIELD, value.isNotBlank()) { "must not be blank" }
        requireValid(FIELD, value == value.trim()) { "must not have surrounding whitespace" }
        requireValid(FIELD, value.length <= MAX_LENGTH) { "must be at most $MAX_LENGTH characters" }
    }

    override fun toString(): String = value

    companion object {
        const val FIELD = "name"
        const val MAX_LENGTH = 128

        /** Trims [raw] before validating, so callers (DTOs, free-solo chip input) never have to trim by hand. */
        fun parse(raw: String): VocabularyName = VocabularyName(raw.trim())
    }
}

/**
 * `?limit=` bound for a vocabulary search; a separate, smaller cap than [PageSize] since it feeds a short
 * autocomplete list rather than a paged listing.
 */
@JvmInline
value class VocabularySearchLimit(val value: Int) {
    init {
        requireValid(FIELD, value in 1..MAX) { "must be between 1 and $MAX" }
    }

    companion object {
        const val FIELD = "limit"
        const val MAX = 50
        val DEFAULT = VocabularySearchLimit(10)
    }
}

/** What a vocabulary repository's `create` found: the [entry], plus whether it was just inserted. */
data class VocabularyCreation<T>(val entry: T, val created: Boolean)
