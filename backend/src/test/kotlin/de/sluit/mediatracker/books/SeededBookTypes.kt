package de.sluit.mediatracker.books

import de.sluit.mediatracker.common.persistence.SeededRow

/** The four book type ids seeded by db/migration/V012__books.sql, for use in test fixtures. */
object SeededBookTypes {
    const val HARDCOVER = "6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0001"
    const val PAPERBACK = "6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0002"
    const val KINDLE = "6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0003"
    const val AUDIBLE = "6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0004"

    /** The canonical rows (id, label, colour) exactly as the migration inserts them. */
    val ROWS = listOf(
        SeededRow(HARDCOVER, "Hardcover", "5D4037"),
        SeededRow(PAPERBACK, "Paperback", "00796B"),
        SeededRow(KINDLE, "Kindle", "1A73B5"),
        SeededRow(AUDIBLE, "Audible", "F7991C"),
    )
}
