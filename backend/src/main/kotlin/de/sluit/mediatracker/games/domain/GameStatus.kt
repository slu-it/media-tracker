package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException

/*
 * Status enums of the games domain (MT-007). Each mirrors its wire representation from `name` so the two never
 * drift apart, and validates a raw wire value in `from`, throwing directly rather than via `requireValid`
 * because there is no instance yet to validate in an `init` block.
 */

/** Default value of the `hidden` game status field, written down once here (ADR 0017). */
const val DEFAULT_HIDDEN = false

/** Whether a game is owned or merely on the watchlist. */
enum class Ownership {
    WATCHLIST,
    OWNED,
    ;

    val wire: String get() = name.lowercase()

    companion object {
        const val FIELD = "ownership"
        val DEFAULT = WATCHLIST

        fun from(wire: String): Ownership = entries.firstOrNull { it.wire == wire }
            ?: throw InvalidValueException(FIELD, "must be one of ${entries.joinToString { it.wire }}")
    }
}

/** How far a game has been played. [COMPLETED] is the "100%" state; that spelling is a UI label only. */
enum class Progress {
    NOT_STARTED,
    PLAYING,
    FINISHED,
    COMPLETED,
    PAUSED,
    ABANDONED,
    ;

    val wire: String get() = name.lowercase()

    companion object {
        const val FIELD = "progress"
        val DEFAULT = NOT_STARTED

        fun from(wire: String): Progress = entries.firstOrNull { it.wire == wire }
            ?: throw InvalidValueException(FIELD, "must be one of ${entries.joinToString { it.wire }}")
    }
}
