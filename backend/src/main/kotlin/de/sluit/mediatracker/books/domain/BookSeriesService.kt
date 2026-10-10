package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.ConflictException
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
 * Business use cases behind `GET`/`POST /book-series`. [BookService] resolves `series` itself through
 * [BookSeriesRepository] directly (mirroring how it resolves `typeIds`); this service exists for the two
 * operations a book does not need: searching the vocabulary and growing it.
 */
class BookSeriesService(private val series: BookSeriesRepository) {
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<BookSeries> = series.search(term, limit)

    /** All series with their book counts, including empty ones, ordered by name. */
    suspend fun summaries(): List<BookSeriesSummary> = series.findSummaries()

    /** Idempotent: an existing case-insensitive name match is returned instead of a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<BookSeries> = series.create(name)

    /** Deletes an unused series; unknown id is a [NotFoundException], one still linked to a book a [ConflictException]. */
    suspend fun delete(id: BookSeriesId) {
        when (series.delete(id)) {
            DeleteOutcome.DELETED -> Unit
            DeleteOutcome.NOT_FOUND -> throw NotFoundException(RESOURCE, id.toString())
            DeleteOutcome.IN_USE -> throw ConflictException(RESOURCE, id.toString())
        }
    }

    /** Unknown id is a [NotFoundException], a name another series carries a [NameTakenException] naming that series. */
    suspend fun rename(id: BookSeriesId, name: VocabularyName): BookSeries =
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
    suspend fun merge(sourceId: BookSeriesId, targetId: BookSeriesId): BookSeries {
        if (sourceId == targetId) throw InvalidValueException(TARGET_FIELD, "must differ from the series itself")
        return when (val outcome = series.merge(sourceId, targetId)) {
            is MergeOutcome.Merged -> outcome.target
            MergeOutcome.SourceNotFound -> throw NotFoundException(RESOURCE, sourceId.toString())
            MergeOutcome.TargetNotFound -> throw NotFoundException(RESOURCE, targetId.toString())
        }
    }

    private companion object {
        const val TARGET_FIELD = "targetId"
        const val RESOURCE = "book series"
    }
}
