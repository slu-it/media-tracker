package de.sluit.mediatracker.books.domain

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
 * Business use cases behind `/book-narrators`. [BookService] resolves `narratorIds` itself through
 * [BookNarratorRepository] directly (mirroring how it resolves `typeIds`); this service covers what a book does
 * not need: searching and growing the vocabulary, and the narrators view (summaries with book counts, rename,
 * merge and delete; `GET /book-narrators.summaries`).
 */
class BookNarratorService(private val narrators: BookNarratorRepository) {
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<BookNarrator> =
        narrators.search(term, limit)

    /** Every narrator including those without books, with their book count; ordered by name, then id. */
    suspend fun summaries(): List<BookNarratorSummary> = narrators.findSummaries()

    /** Idempotent: an existing case-insensitive name match is returned instead of a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<BookNarrator> = narrators.create(name)

    /** Deletes an unused narrator; unknown id is a [NotFoundException], one still linked to a book a [ConflictException]. */
    suspend fun delete(id: BookNarratorId) {
        when (narrators.delete(id)) {
            DeleteOutcome.DELETED -> Unit
            DeleteOutcome.NOT_FOUND -> throw NotFoundException(RESOURCE, id.toString())
            DeleteOutcome.IN_USE -> throw ConflictException(RESOURCE, id.toString())
        }
    }

    /** Unknown id is a [NotFoundException], a name another narrator carries a [NameTakenException] naming that narrator. */
    suspend fun rename(id: BookNarratorId, name: VocabularyName): BookNarrator =
        when (val outcome = narrators.rename(id, name)) {
            is RenameOutcome.Renamed -> outcome.entry

            RenameOutcome.NotFound -> throw NotFoundException(RESOURCE, id.toString())

            is RenameOutcome.Taken ->
                throw NameTakenException(RESOURCE, outcome.existing.id.toString(), outcome.existing.name.value)
        }

    /**
     * Folds [sourceId] into [targetId] and returns the target. Merging into itself is an [InvalidValueException];
     * an unknown source or target a [NotFoundException].
     */
    suspend fun merge(sourceId: BookNarratorId, targetId: BookNarratorId): BookNarrator {
        if (sourceId == targetId) throw InvalidValueException(TARGET_FIELD, "must differ from the narrator itself")
        return when (val outcome = narrators.merge(sourceId, targetId)) {
            is MergeOutcome.Merged -> outcome.target
            MergeOutcome.SourceNotFound -> throw NotFoundException(RESOURCE, sourceId.toString())
            MergeOutcome.TargetNotFound -> throw NotFoundException(RESOURCE, targetId.toString())
        }
    }

    private companion object {
        const val TARGET_FIELD = "targetId"
        const val RESOURCE = "book narrator"
    }
}
