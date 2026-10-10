package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.ConflictException
import de.sluit.mediatracker.common.domain.CreateOutcome
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.NameTakenException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.RenameOutcome

/**
 * Business use cases of the editable game platforms (`/game-platforms`): the platforms view, creating, updating and
 * deleting an unused platform. [GameService] still lists and resolves platforms itself.
 */
class GamePlatformService(private val platforms: GamePlatformRepository) {
    /** Every platform including those without games, with their game count; ordered by label, then id. */
    suspend fun summaries(): List<GamePlatformSummary> = platforms.findSummaries()

    /** A label another platform carries (case/accent-insensitively) is a [NameTakenException] naming that platform. */
    suspend fun create(label: PlatformLabel, color: HexColor): GamePlatform =
        when (val outcome = platforms.create(label, color)) {
            is CreateOutcome.Created -> outcome.entry
            is CreateOutcome.Taken -> throw taken(outcome.existing)
        }

    /** `null` keeps a field. Unknown id is a [NotFoundException], a taken label a [NameTakenException]. */
    suspend fun update(id: GamePlatformId, label: PlatformLabel?, color: HexColor?): GamePlatform =
        when (val outcome = platforms.update(id, label, color)) {
            is RenameOutcome.Renamed -> outcome.entry
            RenameOutcome.NotFound -> throw NotFoundException(RESOURCE, id.toString())
            is RenameOutcome.Taken -> throw taken(outcome.existing)
        }

    /** Deletes an unused platform; unknown id is a [NotFoundException], one still linked to a game a [ConflictException]. */
    suspend fun delete(id: GamePlatformId) {
        when (platforms.delete(id)) {
            DeleteOutcome.DELETED -> Unit
            DeleteOutcome.NOT_FOUND -> throw NotFoundException(RESOURCE, id.toString())
            DeleteOutcome.IN_USE -> throw ConflictException(RESOURCE, id.toString())
        }
    }

    private fun taken(existing: GamePlatform) =
        NameTakenException(RESOURCE, existing.id.toString(), existing.label.value)

    private companion object {
        const val RESOURCE = "game platform"
    }
}
