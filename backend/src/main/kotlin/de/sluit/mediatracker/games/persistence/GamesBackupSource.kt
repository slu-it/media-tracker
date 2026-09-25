package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.persistence.ExposedBackupSource

/**
 * [de.sluit.mediatracker.common.domain.BackupSource] for every table the games domain owns (MT-023, ADR 0027).
 * Parents before the tables that reference them: platforms and games before the game-to-platform junction and
 * the expansions that reference a game.
 */
object GamesBackupSource : ExposedBackupSource(
    listOf(GamePlatformsTable, GamesTable, GameToPlatformTable, GameExpansionsTable),
)
