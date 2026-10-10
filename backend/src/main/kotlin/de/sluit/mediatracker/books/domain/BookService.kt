package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.SearchTerm

/**
 * Business use cases for books. Deliberately thin while the feature is plain CRUD; decisions that do not
 * belong to HTTP or SQL (id assignment, existence checks, applying a patch, resolving type, author, narrator and series ids) live
 * here and nowhere else.
 */
class BookService(
    private val books: BookRepository,
    private val types: BookTypeRepository,
    private val authors: BookAuthorRepository,
    private val narrators: BookNarratorRepository,
    private val series: BookSeriesRepository,
) {
    suspend fun create(newBook: NewBook): Book {
        val book = Book(
            id = BookId.new(),
            title = newBook.title,
            releaseYear = newBook.effectiveReleaseYear,
            types = resolveTypes(newBook.typeIds),
            authors = resolveAuthors(newBook.authorIds),
            narrators = resolveNarrators(newBook.narratorIds),
            series = resolveSeries(newBook.series),
            description = newBook.description,
            coverImageUrl = newBook.coverImageUrl,
            ownership = newBook.ownership,
            progress = newBook.progress,
            releaseDate = newBook.releaseDate,
        )
        books.insert(book)
        return book
    }

    /** Load, apply, save. Two transactions; acceptable for a single-user application. */
    suspend fun update(id: BookId, patch: BookPatch): Book {
        val current = books.findById(id) ?: throw NotFoundException(RESOURCE, id.toString())
        val resolvedTypes = patch.typeIds?.let { resolveTypes(it) } ?: current.types
        val resolvedAuthors = patch.authorIds?.let { resolveAuthors(it) } ?: current.authors
        val resolvedNarrators = patch.narratorIds?.let { resolveNarrators(it) } ?: current.narrators
        val resolvedSeries = patch.series?.let { resolveSeries(it) } ?: current.series
        val updated = patch.applyTo(current, resolvedTypes, resolvedAuthors, resolvedNarrators, resolvedSeries)
        if (!books.update(updated)) throw NotFoundException(RESOURCE, id.toString())
        return updated
    }

    /** Idempotent: deleting an unknown id is not an error. */
    suspend fun delete(id: BookId) {
        books.deleteById(id)
    }

    /**
     * Decides between the title-ordered page ([search] absent, [filters] empty and [sort] the default
     * [BookSort.TITLE]) and the filtered/search listing (any of the three present).
     */
    suspend fun list(
        request: PageRequest,
        search: SearchTerm?,
        filters: BookFilters,
        sort: BookSort = BookSort.DEFAULT,
    ): Page<Book> = if (search == null && filters.isEmpty && sort == BookSort.TITLE) {
        books.findPage(request)
    } else {
        books.search(search, filters, request, sort)
    }

    /** The books of one series in series order; an unknown [seriesId] is not found, an empty series is an empty list. */
    suspend fun listBySeries(seriesId: BookSeriesId): List<Book> {
        if (series.findByIds(setOf(seriesId)).isEmpty()) throw NotFoundException(SERIES_RESOURCE, seriesId.toString())
        return books.findBySeries(seriesId)
    }

    /** The books of one author in release order; an unknown [authorId] is not found, an author without books is an empty list. */
    suspend fun listByAuthor(authorId: BookAuthorId): List<Book> {
        if (authors.findByIds(setOf(authorId)).isEmpty()) throw NotFoundException(AUTHOR_RESOURCE, authorId.toString())
        return books.findByAuthor(authorId)
    }

    /** The books of one narrator in release order; an unknown [narratorId] is not found, one without books an empty list. */
    suspend fun listByNarrator(narratorId: BookNarratorId): List<Book> {
        if (narrators.findByIds(setOf(narratorId)).isEmpty()) {
            throw NotFoundException(NARRATOR_RESOURCE, narratorId.toString())
        }
        return books.findByNarrator(narratorId)
    }

    suspend fun listTypes(): List<BookType> = types.findAll()

    /** The filter values that actually occur in the stored books, ordered for display. */
    suspend fun meta(): BookMeta {
        val used = books.findUsedFilterValues()
        return BookMeta(
            types = types.findAll().filter { it.id in used.typeCounts.keys },
            ownership = BookOwnership.entries.filter { it in used.ownership },
            progress = BookProgress.entries.filter { it in used.progress },
            releaseYears = used.releaseYears.sortedByDescending { it.value },
            typeCounts = used.typeCounts,
        )
    }

    private suspend fun resolveTypes(ids: Set<BookTypeId>): List<BookType> {
        if (ids.isEmpty()) return emptyList()
        val found = types.findByIds(ids)
        val missing = ids - found.map { it.id }.toSet()
        if (missing.isNotEmpty()) {
            throw InvalidValueException(BookTypeId.FIELD, "unknown type id ${missing.first()}")
        }
        return found.sortedForBook()
    }

    private suspend fun resolveAuthors(ids: Set<BookAuthorId>): List<BookAuthor> {
        if (ids.isEmpty()) return emptyList()
        val found = authors.findByIds(ids)
        val missing = ids - found.map { it.id }.toSet()
        if (missing.isNotEmpty()) {
            throw InvalidValueException(BookAuthorId.FIELD, "unknown author id ${missing.first()}")
        }
        return found.sortedByNameForBook()
    }

    private suspend fun resolveNarrators(ids: Set<BookNarratorId>): List<BookNarrator> {
        if (ids.isEmpty()) return emptyList()
        val found = narrators.findByIds(ids)
        val missing = ids - found.map { it.id }.toSet()
        if (missing.isNotEmpty()) {
            throw InvalidValueException(BookNarratorId.FIELD, "unknown narrator id ${missing.first()}")
        }
        return found.sortedByNameForBook()
    }

    private suspend fun resolveSeries(positions: Map<BookSeriesId, BookSeriesPosition?>): List<BookSeriesEntry> {
        if (positions.isEmpty()) return emptyList()
        val found = series.findByIds(positions.keys)
        val missing = positions.keys - found.map { it.id }.toSet()
        if (missing.isNotEmpty()) {
            throw InvalidValueException(BookSeriesId.FIELD, "unknown series id ${missing.first()}")
        }
        return found.map { BookSeriesEntry(it, positions[it.id]) }.sortedByNameForBook()
    }

    companion object {
        const val RESOURCE = "book"
        const val AUTHOR_RESOURCE = "book author"
        const val NARRATOR_RESOURCE = "book narrator"
        const val SERIES_RESOURCE = "book series"
    }
}
