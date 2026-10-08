package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.WireEnum
import de.sluit.mediatracker.common.domain.fromWire

/*
 * Status enums of the books domain (ADR 0034). Each mirrors its wire representation from `name` so the two never
 * drift apart, and validates a raw wire value in `from`, throwing directly rather than via `requireValid`
 * because there is no instance yet to validate in an `init` block.
 */

/**
 * Whether a book is owned or merely on the watchlist.
 * Declaration order is the order offered in UIs, meta and MCP schemas; the ordinal is never persisted.
 * The frontend mirrors this order in its book status values.
 */
enum class BookOwnership : WireEnum {
    WATCHLIST,
    OWNED,
    ;

    override val wire: String get() = name.lowercase()

    companion object {
        const val FIELD = "ownership"
        val DEFAULT = WATCHLIST

        fun from(wire: String): BookOwnership = entries.fromWire(FIELD, wire)
    }
}

/**
 * How far a book has been read.
 * Declaration order is the order offered in UIs, meta and MCP schemas; the ordinal is never persisted.
 * The frontend mirrors this order in its book status values.
 */
enum class BookProgress : WireEnum {
    ABANDONED,
    NOT_STARTED,
    PAUSED,
    READING,
    FINISHED,
    ;

    override val wire: String get() = name.lowercase()

    companion object {
        const val FIELD = "progress"
        val DEFAULT = NOT_STARTED

        fun from(wire: String): BookProgress = entries.fromWire(FIELD, wire)
    }
}
