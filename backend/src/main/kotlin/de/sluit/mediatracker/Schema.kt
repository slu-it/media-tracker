package de.sluit.mediatracker

import de.sluit.mediatracker.auth.persistence.SessionsTable
import de.sluit.mediatracker.auth.persistence.UsersTable
import de.sluit.mediatracker.common.domain.BackupSource
import de.sluit.mediatracker.games.persistence.GameExpansionsTable
import de.sluit.mediatracker.games.persistence.GamePlatformsTable
import de.sluit.mediatracker.games.persistence.GameToPlatformTable
import de.sluit.mediatracker.games.persistence.GamesBackupSource
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

/**
 * Every domain's [BackupSource], wired once here (MT-023, ADR 0027) and shared by `Application.module()`
 * (`BackupService(backupSources)`) and `BackupCoverageTest`, so a new domain table that forgets a backup source
 * fails the build instead of silently missing from every export. `users` and `sessions` are system tables,
 * deliberately never backed up.
 */
val backupSources: List<BackupSource> = listOf(GamesBackupSource)
