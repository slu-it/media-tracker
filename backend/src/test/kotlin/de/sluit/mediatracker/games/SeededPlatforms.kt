package de.sluit.mediatracker.games

import de.sluit.mediatracker.common.persistence.SeededRow

/** The four platforms seeded by db/migration/V002__games.sql, for use in test fixtures. */
object SeededPlatforms {
    const val PC = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d0001"
    const val PLAYSTATION = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d0002"
    const val XBOX = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d0003"
    const val NINTENDO = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d0004"

    /** The canonical rows (id, label, colour) exactly as the migration inserts them. */
    val ROWS = listOf(
        SeededRow(PC, "PC", "757575"),
        SeededRow(PLAYSTATION, "PlayStation", "0070D1"),
        SeededRow(XBOX, "Xbox", "107C10"),
        SeededRow(NINTENDO, "Nintendo", "E60012"),
    )
}
