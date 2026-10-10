package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.ConflictException
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.MergeOutcome
import de.sluit.mediatracker.common.domain.NameTakenException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.RenameOutcome
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit

/**
 * Business use cases behind `/game-developers`. [GameService] resolves `developerIds` itself through
 * [GameDeveloperRepository] directly (mirroring how it resolves `platformIds`); this service covers what a game does
 * not need: searching and growing the vocabulary, and the developers view (summaries with game counts, rename,
 * merge and delete; `GET /game-developers.summaries`).
 */
class GameDeveloperService(private val developers: GameDeveloperRepository) {
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<GameDeveloper> =
        developers.search(term, limit)

    /** Every developer including those without games, with their game count; ordered by name, then id. */
    suspend fun summaries(): List<GameDeveloperSummary> = developers.findSummaries()

    /** Idempotent: an existing case-insensitive name match is returned instead of a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<GameDeveloper> = developers.create(name)

    /** Deletes an unused developer; unknown id is a [NotFoundException], one still linked to a game a [ConflictException]. */
    suspend fun delete(id: GameDeveloperId) {
        when (developers.delete(id)) {
            DeleteOutcome.DELETED -> Unit
            DeleteOutcome.NOT_FOUND -> throw NotFoundException(RESOURCE, id.toString())
            DeleteOutcome.IN_USE -> throw ConflictException(RESOURCE, id.toString())
        }
    }

    /** Unknown id is a [NotFoundException], a name another developer carries a [NameTakenException] naming that developer. */
    suspend fun rename(id: GameDeveloperId, name: VocabularyName): GameDeveloper =
        when (val outcome = developers.rename(id, name)) {
            is RenameOutcome.Renamed -> outcome.entry

            RenameOutcome.NotFound -> throw NotFoundException(RESOURCE, id.toString())

            is RenameOutcome.Taken ->
                throw NameTakenException(RESOURCE, outcome.existing.id.toString(), outcome.existing.name.value)
        }

    /**
     * Folds [sourceId] into [targetId] and returns the target. Merging into itself is an [InvalidValueException];
     * an unknown source or target a [NotFoundException].
     */
    suspend fun merge(sourceId: GameDeveloperId, targetId: GameDeveloperId): GameDeveloper {
        if (sourceId == targetId) throw InvalidValueException(TARGET_FIELD, "must differ from the developer itself")
        return when (val outcome = developers.merge(sourceId, targetId)) {
            is MergeOutcome.Merged -> outcome.target
            MergeOutcome.SourceNotFound -> throw NotFoundException(RESOURCE, sourceId.toString())
            MergeOutcome.TargetNotFound -> throw NotFoundException(RESOURCE, targetId.toString())
        }
    }

    private companion object {
        const val TARGET_FIELD = "targetId"
        const val RESOURCE = "game developer"
    }
}
