package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException

/**
 * Ordering for [GameService.list] (MT-026): the default title order, release date ascending/descending, or
 * rating descending. Mirrors its wire representation explicitly (like [MissingField], unlike the `name.lowercase()`
 * status enums in `GameStatus.kt`) and validates a raw wire value in [from], throwing directly rather than via
 * `requireValid` because there is no instance yet to validate in an `init` block.
 */
enum class GameSort(val wire: String) {
    TITLE("title"),
    RELEASE_ASC("release_asc"),
    RELEASE_DESC("release_desc"),
    RATING_DESC("rating_desc"),
    ;

    companion object {
        const val FIELD = "sort"
        val DEFAULT = TITLE

        fun from(wire: String): GameSort = entries.firstOrNull { it.wire == wire }
            ?: throw InvalidValueException(FIELD, "must be one of ${entries.joinToString { it.wire }}")
    }
}
