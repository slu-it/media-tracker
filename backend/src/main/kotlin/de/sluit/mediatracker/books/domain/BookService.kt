package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.SearchTerm

/**
 * Business use cases for books. Deliberately thin while the feature is plain CRUD; decisions that do not
 * belong to HTTP or SQL (id assignment, existence checks, applying a patch, resolving type and author ids) live
 * here and nowhere else.
 */
class BookService(
    private val books: BookRepository,
    private val types: BookTypeRepository,
    private val authors: BookAuthorRepository,
) {
    suspend fun create(newBook: NewBook): Book {
        val book = Book(
            id = BookId.new(),
            title = newBook.title,
            releaseYear = newBook.effectiveReleaseYear,
            types = resolveTypes(newBook.typeIds),
            authors = resolveAuthors(newBook.authorIds),
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
        val updated = patch.applyTo(current, resolvedTypes, resolvedAuthors)
        if (!books.update(updated)) throw NotFoundException(RESOURCE, id.toString())
        return updated
    }

    /** Idempotent: deleting an unknown id is not an error. */
    suspend fun delete(id: BookId) {
        books.deleteById(id)
    }

    /**
     * Decides between the title-ordered page ([search] absent and [filters] empty) and the filtered/search
     * listing (either present).
     */
    suspend fun list(request: PageRequest, search: SearchTerm?, filters: BookFilters): Page<Book> =
        if (search == null && filters.isEmpty) {
            books.findPage(request)
        } else {
            books.search(search, filters, request)
        }

    suspend fun listTypes(): List<BookType> = types.findAll()

    /** The filter values that actually occur in the stored books, ordered for display. */
    suspend fun meta(): BookMeta {
        val used = books.findUsedFilterValues()
        return BookMeta(
            types = types.findAll().filter { it.id in used.typeIds },
            ownership = BookOwnership.entries.filter { it in used.ownership },
            progress = BookProgress.entries.filter { it in used.progress },
            releaseYears = used.releaseYears.sortedByDescending { it.value },
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

    companion object {
        const val RESOURCE = "book"
    }
}
