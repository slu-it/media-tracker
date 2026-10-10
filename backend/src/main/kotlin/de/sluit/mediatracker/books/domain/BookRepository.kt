package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.MergeOutcome
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.RenameOutcome
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
     * Filtered and/or fulltext-searched listing. [sort] (default [BookSort.TITLE]) picks the ordering; with a
     * [term] and the default [BookSort.TITLE], a book matches on its title only (a title fulltext hit or a title
     * prefix LIKE match); prefix hits come first, then relevance, then title, then id, overridden entirely by
     * any other [sort] (the match itself still filters). Without a [term] the ordering is [sort] alone,
     * [BookSort.TITLE] being title, then id, same as [findPage]. [filters] AND across categories and
     * OR inside one (an `IN` list, or `IS NULL` checks for the `missing` category); an empty [BookFilters]
     * applies no predicate. A term that contains no searchable word behaves as if it were absent.
     */
    suspend fun search(
        term: SearchTerm?,
        filters: BookFilters,
        request: PageRequest,
        sort: BookSort = BookSort.TITLE,
    ): Page<Book>

    /**
     * The distinct values each filter category currently has across all books, unordered, plus the number of
     * books per type. Only the four categories the REST filters expose; `missing` is never populated, it has no lookup values to offer.
     */
    suspend fun findUsedFilterValues(): UsedBookFilterValues

    /**
     * All books linked to [seriesId], unpaged: ordered by the book's position in that series ascending, books
     * without a position last (ordered by title), then title, then id.
     */
    suspend fun findBySeries(seriesId: BookSeriesId): List<Book>

    /**
     * All books linked to [authorId], unpaged: ordered by release year, then release date (books without a
     * date last within a year), then title, then id.
     */
    suspend fun findByAuthor(authorId: BookAuthorId): List<Book>

    /** All books linked to [narratorId], unpaged, in the same order as [findByAuthor]. */
    suspend fun findByNarrator(narratorId: BookNarratorId): List<Book>
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

    /** Every author including those without books, with their book count; ordered by name, then id. Unpaged. */
    suspend fun findSummaries(): List<BookAuthorSummary>

    /** Idempotent: a case-insensitive existing match is returned instead of inserting a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<BookAuthor>

    /** Deletes the author unless a book still references it ([DeleteOutcome.IN_USE]). */
    suspend fun delete(id: BookAuthorId): DeleteOutcome

    /**
     * Renames the author. [RenameOutcome.Taken] when another author carries the name (case/accent-insensitively);
     * a spelling that only differs from the author's own name that way is a plain rename.
     */
    suspend fun rename(id: BookAuthorId, name: VocabularyName): RenameOutcome<BookAuthor>

    /**
     * Folds [sourceId] into [targetId] in one transaction: every book of the source becomes a book of the target
     * (once), then the source is deleted. [MergeOutcome.SourceNotFound] / [MergeOutcome.TargetNotFound] when that
     * entry does not exist.
     */
    suspend fun merge(sourceId: BookAuthorId, targetId: BookAuthorId): MergeOutcome<BookAuthor>
}

/**
 * Persistence port of the user-grown narrator vocabulary. Implemented in `books.persistence`; the domain never
 * imports that package, so dependencies point inward only.
 */
interface BookNarratorRepository {
    /**
     * Fulltext prefix search on the name, ordered by score, then name, then id; a blank/`null` [term] lists
     * narrators alphabetically instead. Capped at [limit].
     */
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<BookNarrator>

    suspend fun findByIds(ids: Set<BookNarratorId>): List<BookNarrator>

    /** Every narrator including those without books, with their book count; ordered by name, then id. Unpaged. */
    suspend fun findSummaries(): List<BookNarratorSummary>

    /** Idempotent: a case-insensitive existing match is returned instead of inserting a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<BookNarrator>

    /** Deletes the narrator unless a book still references it ([DeleteOutcome.IN_USE]). */
    suspend fun delete(id: BookNarratorId): DeleteOutcome

    /**
     * Renames the narrator. [RenameOutcome.Taken] when another narrator carries the name (case/accent-insensitively);
     * a spelling that only differs from the narrator's own name that way is a plain rename.
     */
    suspend fun rename(id: BookNarratorId, name: VocabularyName): RenameOutcome<BookNarrator>

    /**
     * Folds [sourceId] into [targetId] in one transaction: every book of the source becomes a book of the target
     * (once), then the source is deleted. [MergeOutcome.SourceNotFound] / [MergeOutcome.TargetNotFound] when that
     * entry does not exist.
     */
    suspend fun merge(sourceId: BookNarratorId, targetId: BookNarratorId): MergeOutcome<BookNarrator>
}

/**
 * Persistence port of the user-grown series vocabulary. Implemented in `books.persistence`; the domain never
 * imports that package, so dependencies point inward only.
 */
interface BookSeriesRepository {
    /**
     * Fulltext prefix search on the name, ordered by score, then name, then id; a blank/`null` [term] lists
     * series alphabetically instead. Capped at [limit].
     */
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<BookSeries>

    suspend fun findByIds(ids: Set<BookSeriesId>): List<BookSeries>

    /** Every series including those without books, with its book count; ordered by name, then id. Unpaged. */
    suspend fun findSummaries(): List<BookSeriesSummary>

    /** Idempotent: a case-insensitive existing match is returned instead of inserting a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<BookSeries>

    /** Deletes the series unless a book still references it ([DeleteOutcome.IN_USE]). */
    suspend fun delete(id: BookSeriesId): DeleteOutcome

    /**
     * Renames the series. [RenameOutcome.Taken] when another series carries the name (case/accent-insensitively);
     * a spelling that only differs from the series' own name that way is a plain rename.
     */
    suspend fun rename(id: BookSeriesId, name: VocabularyName): RenameOutcome<BookSeries>

    /**
     * Folds [sourceId] into [targetId] in one transaction: every book of the source becomes a book of the target
     * (once), then the source is deleted. A book in both keeps the target's position, or the source's when the
     * target's is null. [MergeOutcome.SourceNotFound] / [MergeOutcome.TargetNotFound] when that entry does not
     * exist.
     */
    suspend fun merge(sourceId: BookSeriesId, targetId: BookSeriesId): MergeOutcome<BookSeries>
}
