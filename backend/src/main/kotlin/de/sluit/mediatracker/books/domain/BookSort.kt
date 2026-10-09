package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.WireEnum
import de.sluit.mediatracker.common.domain.fromWire

/**
 * Ordering for [BookService.list]: the default title order, or release date ascending/descending. Mirrors its
 * wire representation explicitly (like [BookMissingField]) and validates a raw wire value in [from], throwing
 * through [fromWire] rather than via `requireValid` because there is no instance yet to validate in an `init`
 * block. Same shape as `GameSort`, minus the rating order: books have no rating.
 */
enum class BookSort(override val wire: String) : WireEnum {
    TITLE("title"),
    RELEASE_ASC("release_asc"),
    RELEASE_DESC("release_desc"),
    ;

    companion object {
        const val FIELD = "sort"
        val DEFAULT = TITLE

        fun from(wire: String): BookSort = entries.fromWire(FIELD, wire)
    }
}
