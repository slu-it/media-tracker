package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.persistence.EditableVocabulary
import de.sluit.mediatracker.common.persistence.ExposedBackupSource
import de.sluit.mediatracker.games.domain.PlatformLabel

/**
 * [de.sluit.mediatracker.common.domain.BackupSource] for every table the games domain owns (MT-023, ADR 0027;
 * developers and release date added in MT-025, ADR 0029). Parents before the tables that reference them:
 * platforms and games before the game-to-platform junction, the expansions that reference a game, and
 * developers before the game-to-developer junction that references both games and developers.
 */
object GamesBackupSource : ExposedBackupSource(
    listOf(
        GamePlatformsTable,
        GamesTable,
        GameToPlatformTable,
        GameExpansionsTable,
        GameDevelopersTable,
        GameToDeveloperTable,
    ),
    // Editable: a restored dump carries the platforms' current labels and colours.
    updatableTables = mapOf(
        GamePlatformsTable to
            EditableVocabulary(GamePlatformsTable.label, GamePlatformsTable.associatedColor) { PlatformLabel(it) },
    ),
)
