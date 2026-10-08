package de.sluit.mediatracker.books.domain

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

    /** Idempotent: an existing case-insensitive name match is returned instead of a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<BookSeries> = series.create(name)
}
