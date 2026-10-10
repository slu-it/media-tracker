package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.domain.BookNarrator
import de.sluit.mediatracker.books.domain.BookNarratorId
import de.sluit.mediatracker.books.domain.BookNarratorRepository
import de.sluit.mediatracker.books.domain.BookNarratorSummary
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.MergeOutcome
import de.sluit.mediatracker.common.domain.RenameOutcome
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import de.sluit.mediatracker.common.persistence.ExposedNameVocabulary
import de.sluit.mediatracker.common.persistence.dbQuery
import de.sluit.mediatracker.common.persistence.deleteUnusedVocabularyEntry
import de.sluit.mediatracker.common.persistence.mergeVocabularyEntries
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.count
import org.jetbrains.exposed.v1.core.leftJoin
import org.jetbrains.exposed.v1.jdbc.select
import kotlin.uuid.Uuid

/**
 * [BookNarratorRepository] on Exposed/JDBC: a vocabulary the user grows on the fly, unlike the seeded
 * [BookTypesTable]. Its `name` column carries the `uq_book_narrators_name` unique index. The search, lookup and
 * race-safe create logic lives in [ExposedNameVocabulary]; this class only binds it to [BookNarratorsTable] and
 * the [BookNarrator] entity.
 */
class ExposedBookNarratorRepository : BookNarratorRepository {
    private val vocabulary = ExposedNameVocabulary(
        table = BookNarratorsTable,
        id = BookNarratorsTable.id,
        name = BookNarratorsTable.name,
        toEntity = { id, name -> BookNarrator(BookNarratorId(Uuid.parseHexDash(id)), name) },
    )

    override suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<BookNarrator> =
        vocabulary.search(term, limit)

    override suspend fun findByIds(ids: Set<BookNarratorId>): List<BookNarrator> =
        vocabulary.findByIds(ids.map { it.toString() }.toSet())

    /** One query: `book_narrators LEFT JOIN book_to_narrator`, `COUNT(book_id)` (0 for unreferenced), by name, id. */
    override suspend fun findSummaries(): List<BookNarratorSummary> = dbQuery {
        val count = BookToNarratorTable.bookId.count()
        (BookNarratorsTable leftJoin BookToNarratorTable)
            .select(BookNarratorsTable.id, BookNarratorsTable.name, count)
            .groupBy(BookNarratorsTable.id, BookNarratorsTable.name)
            .orderBy(BookNarratorsTable.name to SortOrder.ASC, BookNarratorsTable.id to SortOrder.ASC)
            .map {
                BookNarratorSummary(
                    narrator = BookNarrator(
                        BookNarratorId(Uuid.parseHexDash(it[BookNarratorsTable.id])),
                        VocabularyName(it[BookNarratorsTable.name]),
                    ),
                    bookCount = it[count].toInt(),
                )
            }
    }

    override suspend fun create(name: VocabularyName): VocabularyCreation<BookNarrator> = vocabulary.create(name)

    /** One transaction: existence check, link check, delete (see [deleteUnusedVocabularyEntry]). */
    override suspend fun delete(id: BookNarratorId): DeleteOutcome = dbQuery {
        deleteUnusedVocabularyEntry(
            vocabTable = BookNarratorsTable,
            vocabId = BookNarratorsTable.id,
            junction = BookToNarratorTable,
            vocabColumn = BookToNarratorTable.narratorId,
            id = id.toString(),
        )
    }

    override suspend fun rename(id: BookNarratorId, name: VocabularyName): RenameOutcome<BookNarrator> =
        vocabulary.rename(id.toString(), name)

    /** One transaction, see [mergeVocabularyEntries]. */
    override suspend fun merge(sourceId: BookNarratorId, targetId: BookNarratorId): MergeOutcome<BookNarrator> =
        dbQuery {
            mergeVocabularyEntries(
                vocabTable = BookNarratorsTable,
                vocabId = BookNarratorsTable.id,
                vocabName = BookNarratorsTable.name,
                junction = BookToNarratorTable,
                itemColumn = BookToNarratorTable.bookId,
                vocabColumn = BookToNarratorTable.narratorId,
                sourceId = sourceId.toString(),
                targetId = targetId.toString(),
                toEntity = { BookNarrator(targetId, it) },
            )
        }

    /** Test seam, see [ExposedNameVocabulary.create]. */
    internal suspend fun create(
        name: VocabularyName,
        afterInitialLookup: () -> Unit,
    ): VocabularyCreation<BookNarrator> = vocabulary.create(name, afterInitialLookup)

    /** Test seam, see [ExposedNameVocabulary.rename]. */
    internal suspend fun rename(
        id: BookNarratorId,
        name: VocabularyName,
        afterLookup: () -> Unit,
    ): RenameOutcome<BookNarrator> = vocabulary.rename(id.toString(), name, afterLookup)
}
