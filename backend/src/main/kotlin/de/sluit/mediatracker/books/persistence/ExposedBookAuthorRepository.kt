package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.domain.BookAuthor
import de.sluit.mediatracker.books.domain.BookAuthorId
import de.sluit.mediatracker.books.domain.BookAuthorRepository
import de.sluit.mediatracker.books.domain.BookAuthorSummary
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import de.sluit.mediatracker.common.persistence.ExposedNameVocabulary
import de.sluit.mediatracker.common.persistence.dbQuery
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.count
import org.jetbrains.exposed.v1.core.leftJoin
import org.jetbrains.exposed.v1.jdbc.select
import kotlin.uuid.Uuid

/**
 * [BookAuthorRepository] on Exposed/JDBC: a vocabulary the user grows on the fly, unlike the seeded
 * [BookTypesTable]. Its `name` column carries the `uq_book_authors_name` unique index. The search, lookup and
 * race-safe create logic lives in [ExposedNameVocabulary]; this class only binds it to [BookAuthorsTable] and
 * the [BookAuthor] entity.
 */
class ExposedBookAuthorRepository : BookAuthorRepository {
    private val vocabulary = ExposedNameVocabulary(
        table = BookAuthorsTable,
        id = BookAuthorsTable.id,
        name = BookAuthorsTable.name,
        toEntity = { id, name -> BookAuthor(BookAuthorId(Uuid.parseHexDash(id)), name) },
    )

    override suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<BookAuthor> =
        vocabulary.search(term, limit)

    override suspend fun findByIds(ids: Set<BookAuthorId>): List<BookAuthor> =
        vocabulary.findByIds(ids.map { it.toString() }.toSet())

    /** One query: `book_authors LEFT JOIN book_to_author`, `COUNT(book_id)` (0 for unreferenced), by name, id. */
    override suspend fun findSummaries(): List<BookAuthorSummary> = dbQuery {
        val count = BookToAuthorTable.bookId.count()
        (BookAuthorsTable leftJoin BookToAuthorTable)
            .select(BookAuthorsTable.id, BookAuthorsTable.name, count)
            .groupBy(BookAuthorsTable.id, BookAuthorsTable.name)
            .orderBy(BookAuthorsTable.name to SortOrder.ASC, BookAuthorsTable.id to SortOrder.ASC)
            .map {
                BookAuthorSummary(
                    author = BookAuthor(
                        BookAuthorId(Uuid.parseHexDash(it[BookAuthorsTable.id])),
                        VocabularyName(it[BookAuthorsTable.name]),
                    ),
                    bookCount = it[count].toInt(),
                )
            }
    }

    override suspend fun create(name: VocabularyName): VocabularyCreation<BookAuthor> = vocabulary.create(name)

    /** Test seam, see [ExposedNameVocabulary.create]. */
    internal suspend fun create(name: VocabularyName, afterInitialLookup: () -> Unit): VocabularyCreation<BookAuthor> =
        vocabulary.create(name, afterInitialLookup)
}
