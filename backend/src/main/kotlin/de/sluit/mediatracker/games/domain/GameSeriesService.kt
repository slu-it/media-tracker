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
 * The game-series vocabulary's own use cases: search, summaries, create, rename, merge and delete.
 * [GameService] resolves a game's `series` references itself through [GameSeriesRepository] directly (mirroring
 * how it resolves `developerIds`); this service holds what a game does not need.
 */
class GameSeriesService(private val series: GameSeriesRepository) {
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<GameSeries> = series.search(term, limit)

    /** All series with their game counts, including empty ones, ordered by name. */
    suspend fun summaries(): List<GameSeriesSummary> = series.findSummaries()

    /** Idempotent: an existing case-insensitive name match is returned instead of a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<GameSeries> = series.create(name)

    /** Deletes an unused series; unknown id is a [NotFoundException], one still linked to a game a [ConflictException]. */
    suspend fun delete(id: GameSeriesId) {
        when (series.delete(id)) {
            DeleteOutcome.DELETED -> Unit
            DeleteOutcome.NOT_FOUND -> throw NotFoundException(RESOURCE, id.toString())
            DeleteOutcome.IN_USE -> throw ConflictException(RESOURCE, id.toString())
        }
    }

    /** Unknown id is a [NotFoundException], a name another series carries a [NameTakenException] naming that series. */
    suspend fun rename(id: GameSeriesId, name: VocabularyName): GameSeries =
        when (val outcome = series.rename(id, name)) {
            is RenameOutcome.Renamed -> outcome.entry

            RenameOutcome.NotFound -> throw NotFoundException(RESOURCE, id.toString())

            is RenameOutcome.Taken ->
                throw NameTakenException(RESOURCE, outcome.existing.id.toString(), outcome.existing.name.value)
        }

    /**
     * Folds [sourceId] into [targetId] and returns the target. Merging into itself is an [InvalidValueException];
     * an unknown source or target a [NotFoundException].
     */
    suspend fun merge(sourceId: GameSeriesId, targetId: GameSeriesId): GameSeries {
        if (sourceId == targetId) throw InvalidValueException(TARGET_FIELD, "must differ from the series itself")
        return when (val outcome = series.merge(sourceId, targetId)) {
            is MergeOutcome.Merged -> outcome.target
            MergeOutcome.SourceNotFound -> throw NotFoundException(RESOURCE, sourceId.toString())
            MergeOutcome.TargetNotFound -> throw NotFoundException(RESOURCE, targetId.toString())
        }
    }

    private companion object {
        const val TARGET_FIELD = "targetId"
        const val RESOURCE = "game series"
    }
}
