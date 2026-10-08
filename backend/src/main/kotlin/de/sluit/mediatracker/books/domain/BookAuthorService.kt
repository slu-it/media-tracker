package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit

/**
 * Business use cases behind `GET`/`POST /book-authors`. [BookService] resolves `authorIds` itself through
 * [BookAuthorRepository] directly (mirroring how it resolves `typeIds`); this service exists for the two
 * operations a book does not need: searching the vocabulary and growing it.
 */
class BookAuthorService(private val authors: BookAuthorRepository) {
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<BookAuthor> = authors.search(term, limit)

    /** Idempotent: an existing case-insensitive name match is returned instead of a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<BookAuthor> = authors.create(name)
}
