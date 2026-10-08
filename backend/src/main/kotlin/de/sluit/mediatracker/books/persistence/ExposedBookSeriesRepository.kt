package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.domain.BookSeries
import de.sluit.mediatracker.books.domain.BookSeriesId
import de.sluit.mediatracker.books.domain.BookSeriesRepository
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import de.sluit.mediatracker.common.persistence.ExposedNameVocabulary
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

    override suspend fun create(name: VocabularyName): VocabularyCreation<BookSeries> = vocabulary.create(name)

    /** Test seam, see [ExposedNameVocabulary.create]. */
    internal suspend fun create(name: VocabularyName, afterInitialLookup: () -> Unit): VocabularyCreation<BookSeries> =
        vocabulary.create(name, afterInitialLookup)
}
