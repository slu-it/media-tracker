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
 * Business use cases behind `GET`/`POST /book-authors`. [BookService] resolves `authorIds` itself through
 * [BookAuthorRepository] directly (mirroring how it resolves `typeIds`); this service exists for the two
 * operations a book does not need: searching the vocabulary and growing it. It also backs the authors view
 * (`GET /book-authors.summaries`).
 */
class BookAuthorService(private val authors: BookAuthorRepository) {
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<BookAuthor> = authors.search(term, limit)

    /** Every author including those without books, with their book count; ordered by name, then id. */
    suspend fun summaries(): List<BookAuthorSummary> = authors.findSummaries()

    /** Idempotent: an existing case-insensitive name match is returned instead of a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<BookAuthor> = authors.create(name)

    /** Deletes an unused author; unknown id is a [NotFoundException], one still linked to a book a [ConflictException]. */
    suspend fun delete(id: BookAuthorId) {
        when (authors.delete(id)) {
            DeleteOutcome.DELETED -> Unit
            DeleteOutcome.NOT_FOUND -> throw NotFoundException(RESOURCE, id.toString())
            DeleteOutcome.IN_USE -> throw ConflictException(RESOURCE, id.toString())
        }
    }

    /** Unknown id is a [NotFoundException], a name another author carries a [NameTakenException] naming that author. */
    suspend fun rename(id: BookAuthorId, name: VocabularyName): BookAuthor =
        when (val outcome = authors.rename(id, name)) {
            is RenameOutcome.Renamed -> outcome.entry

            RenameOutcome.NotFound -> throw NotFoundException(RESOURCE, id.toString())

            is RenameOutcome.Taken ->
                throw NameTakenException(RESOURCE, outcome.existing.id.toString(), outcome.existing.name.value)
        }

    /**
     * Folds [sourceId] into [targetId] and returns the target. Merging into itself is an [InvalidValueException];
     * an unknown source or target a [NotFoundException].
     */
    suspend fun merge(sourceId: BookAuthorId, targetId: BookAuthorId): BookAuthor {
        if (sourceId == targetId) throw InvalidValueException(TARGET_FIELD, "must differ from the author itself")
        return when (val outcome = authors.merge(sourceId, targetId)) {
            is MergeOutcome.Merged -> outcome.target
            MergeOutcome.SourceNotFound -> throw NotFoundException(RESOURCE, sourceId.toString())
            MergeOutcome.TargetNotFound -> throw NotFoundException(RESOURCE, targetId.toString())
        }
    }

    private companion object {
        const val TARGET_FIELD = "targetId"
        const val RESOURCE = "book author"
    }
}
