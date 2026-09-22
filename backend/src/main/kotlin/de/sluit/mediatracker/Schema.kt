package de.sluit.mediatracker

import de.sluit.mediatracker.auth.persistence.SessionsTable
import de.sluit.mediatracker.auth.persistence.UsersTable
import de.sluit.mediatracker.games.persistence.GameExpansionsTable
import de.sluit.mediatracker.games.persistence.GamePlatformsTable
import de.sluit.mediatracker.games.persistence.GameToPlatformTable
import de.sluit.mediatracker.games.persistence.GamesTable

/**
 * Registry of every Exposed table object the application maps, used by the schema drift check
 * [de.sluit.mediatracker.common.persistence.DatabaseFactory.warnOnSchemaDrift] (called at startup in
 * `Application.module()`, and by `SchemaDriftTest`). New feature tables only need to be added here.
 */
val allTables = arrayOf(
    UsersTable,
    SessionsTable,
    GamesTable,
    GamePlatformsTable,
    GameToPlatformTable,
    GameExpansionsTable,
)
