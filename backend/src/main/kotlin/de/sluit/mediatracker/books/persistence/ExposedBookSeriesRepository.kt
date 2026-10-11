package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.domain.BookSeries
import de.sluit.mediatracker.books.domain.BookSeriesId
import de.sluit.mediatracker.books.domain.BookSeriesRepository
import de.sluit.mediatracker.books.domain.BookSeriesSummary
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
import de.sluit.mediatracker.common.persistence.mergeSeriesEntries
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.count
import org.jetbrains.exposed.v1.core.leftJoin
import org.jetbrains.exposed.v1.jdbc.select
import kotlin.uuid.Uuid

/**
 * [BookSeriesRepository] on Exposed/JDBC: a vocabulary the user grows on the fly, unlike the seeded
 * [BookTypesTable]. Its `name` column carries the `uq_book_series_name` unique index. The search, lookup and
 * race-safe create logic lives in [ExposedNameVocabulary]; this class only binds it to [BookSeriesTable] and
 * the [BookSeries] entity.
 */
class ExposedBookSeriesRepository : BookSeriesRepository {
    private val vocabulary = ExposedNameVocabulary(
        table = BookSeriesTable,
        id = BookSeriesTable.id,
        name = BookSeriesTable.name,
        toEntity = { id, name -> BookSeries(BookSeriesId(Uuid.parseHexDash(id)), name) },
    )

    override suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<BookSeries> =
        vocabulary.search(term, limit)

    override suspend fun findByIds(ids: Set<BookSeriesId>): List<BookSeries> =
        vocabulary.findByIds(ids.map { it.toString() }.toSet())

    /** One query: `book_series LEFT JOIN book_to_series`, `COUNT(book_id)` (0 for unreferenced), by name, id. */
    override suspend fun findSummaries(): List<BookSeriesSummary> = dbQuery {
        val count = BookToSeriesTable.bookId.count()
        (BookSeriesTable leftJoin BookToSeriesTable)
            .select(BookSeriesTable.id, BookSeriesTable.name, count)
            .groupBy(BookSeriesTable.id, BookSeriesTable.name)
            .orderBy(BookSeriesTable.name to SortOrder.ASC, BookSeriesTable.id to SortOrder.ASC)
            .map {
                BookSeriesSummary(
                    series = BookSeries(
                        BookSeriesId(Uuid.parseHexDash(it[BookSeriesTable.id])),
                        VocabularyName(it[BookSeriesTable.name]),
                    ),
                    bookCount = it[count].toInt(),
                )
            }
    }

    override suspend fun create(name: VocabularyName): VocabularyCreation<BookSeries> = vocabulary.create(name)

    /** One transaction: existence check, link check, delete (see [deleteUnusedVocabularyEntry]). */
    override suspend fun delete(id: BookSeriesId): DeleteOutcome = dbQuery {
        deleteUnusedVocabularyEntry(
            vocabTable = BookSeriesTable,
            vocabId = BookSeriesTable.id,
            junction = BookToSeriesTable,
            vocabColumn = BookToSeriesTable.seriesId,
            id = id.toString(),
        )
    }

    override suspend fun rename(id: BookSeriesId, name: VocabularyName): RenameOutcome<BookSeries> =
        vocabulary.rename(id.toString(), name)

    /**
     * One transaction, see [mergeSeriesEntries]: a book in both series keeps the target's position, or the
     * source's when the target's is null.
     */
    override suspend fun merge(sourceId: BookSeriesId, targetId: BookSeriesId): MergeOutcome<BookSeries> = dbQuery {
        mergeSeriesEntries(
            vocabTable = BookSeriesTable,
            vocabId = BookSeriesTable.id,
            vocabName = BookSeriesTable.name,
            junction = BookToSeriesTable,
            itemColumn = BookToSeriesTable.bookId,
            seriesColumn = BookToSeriesTable.seriesId,
            positionColumn = BookToSeriesTable.position,
            sourceId = sourceId.toString(),
            targetId = targetId.toString(),
            toEntity = { BookSeries(targetId, it) },
        )
    }

    /** Test seam, see [ExposedNameVocabulary.create]. */
    internal suspend fun create(name: VocabularyName, afterInitialLookup: () -> Unit): VocabularyCreation<BookSeries> =
        vocabulary.create(name, afterInitialLookup)
}
