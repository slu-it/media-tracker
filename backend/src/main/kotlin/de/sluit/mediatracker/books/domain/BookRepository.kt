package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit

/**
 * Persistence port of the books domain. Implemented in `books.persistence`; the domain never imports that
 * package, so dependencies point inward only.
 */
interface BookRepository {
    suspend fun insert(book: Book)

    suspend fun findById(id: BookId): Book?

    /** Cheap existence check; unlike [findById] it loads no types or authors. */
    suspend fun exists(id: BookId): Boolean

    /** @return false when no row with the book's id exists (anymore). */
    suspend fun update(book: Book): Boolean

    /** @return number of deleted rows (0 or 1). */
    suspend fun deleteById(id: BookId): Int

    /** Ordered by title, then id, so paging is deterministic. */
    suspend fun findPage(request: PageRequest): Page<Book>

    /**
     * Filtered and/or fulltext-searched listing. With a [term], a book matches on its title only (a title
     * fulltext hit or a title prefix LIKE match); prefix hits come first, then relevance, then title, then id.
     * Without a [term] the ordering is title, then id, same as [findPage]. [filters] AND across categories and
     * OR inside one (an `IN` list, or `IS NULL` checks for the `missing` category); an empty [BookFilters]
     * applies no predicate. A term that contains no searchable word behaves as if it were absent.
     */
    suspend fun search(term: SearchTerm?, filters: BookFilters, request: PageRequest): Page<Book>

    /**
     * The distinct values each filter category currently has across all books, unordered. Only the four
     * categories the REST filters expose; `missing` is never populated, it has no lookup values to offer.
     */
    suspend fun findUsedFilterValues(): BookFilters
}

/**
 * Persistence port of the (mostly static, seeded) book types. Implemented in `books.persistence`; the domain
 * never imports that package, so dependencies point inward only.
 */
interface BookTypeRepository {
    /** Ordered by label. */
    suspend fun findAll(): List<BookType>

    suspend fun findByIds(ids: Set<BookTypeId>): List<BookType>
}

/**
 * Persistence port of the user-grown author vocabulary. Implemented in `books.persistence`; the domain never
 * imports that package, so dependencies point inward only.
 */
interface BookAuthorRepository {
    /**
     * Fulltext prefix search on the name, ordered by score, then name, then id; a blank/`null` [term] lists
     * authors alphabetically instead. Capped at [limit].
     */
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<BookAuthor>

    suspend fun findByIds(ids: Set<BookAuthorId>): List<BookAuthor>

    /** Idempotent: a case-insensitive existing match is returned instead of inserting a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<BookAuthor>
}
