package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.domain.BookAuthor
import de.sluit.mediatracker.books.domain.BookAuthorId
import de.sluit.mediatracker.books.domain.BookAuthorRepository
import de.sluit.mediatracker.books.domain.BookAuthorSummary
import de.sluit.mediatracker.books.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.MergeOutcome
import de.sluit.mediatracker.common.domain.RenameOutcome
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import de.sluit.mediatracker.common.persistence.ExposedNameVocabulary
import de.sluit.mediatracker.common.persistence.dbQuery
import de.sluit.mediatracker.common.persistence.orOnForeignKeyViolation
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.count
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.leftJoin
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
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

    /**
     * One transaction: existence check, link check, delete. The junction FK is `ON DELETE RESTRICT`, so a link
     * added concurrently after the check makes the delete fail instead of orphaning anything.
     */
    override suspend fun delete(id: BookAuthorId): DeleteOutcome = dbQuery {
        val key = id.toString()
        when {
            BookAuthorsTable.selectAll().where { BookAuthorsTable.id eq key }.empty() -> DeleteOutcome.NOT_FOUND

            !BookToAuthorTable.selectAll().where { BookToAuthorTable.authorId eq key }.empty() -> DeleteOutcome.IN_USE

            else -> orOnForeignKeyViolation(DeleteOutcome.IN_USE) {
                BookAuthorsTable.deleteWhere { BookAuthorsTable.id eq key }
                DeleteOutcome.DELETED
            }
        }
    }

    override suspend fun rename(id: BookAuthorId, name: VocabularyName): RenameOutcome<BookAuthor> =
        vocabulary.rename(id.toString(), name)

    /**
     * One transaction, both author rows locked `FOR UPDATE` in id order (so two opposite merges cannot deadlock).
     * Links of the source whose book is not yet linked to the target are re-pointed by insert, then every
     * source link and the source row are deleted.
     */
    override suspend fun merge(sourceId: BookAuthorId, targetId: BookAuthorId): MergeOutcome<BookAuthor> = dbQuery {
        val source = sourceId.toString()
        val target = targetId.toString()
        val rows = BookAuthorsTable.selectAll()
            .where { BookAuthorsTable.id inList listOf(source, target) }
            .orderBy(BookAuthorsTable.id to SortOrder.ASC)
            .forUpdate()
            .associateBy { it[BookAuthorsTable.id] }
        val targetRow = rows[target]
        if (rows[source] == null) return@dbQuery MergeOutcome.SourceNotFound
        if (targetRow == null) return@dbQuery MergeOutcome.TargetNotFound

        val alreadyLinked = BookToAuthorTable.select(BookToAuthorTable.bookId)
            .where { BookToAuthorTable.authorId eq target }
            .map { it[BookToAuthorTable.bookId] }
            .toSet()
        val moved = BookToAuthorTable.select(BookToAuthorTable.bookId)
            .where { BookToAuthorTable.authorId eq source }
            .map { it[BookToAuthorTable.bookId] }
            .filterNot { it in alreadyLinked }
        BookToAuthorTable.batchInsert(moved) { bookId ->
            this[BookToAuthorTable.bookId] = bookId
            this[BookToAuthorTable.authorId] = target
        }
        BookToAuthorTable.deleteWhere { BookToAuthorTable.authorId eq source }
        BookAuthorsTable.deleteWhere { BookAuthorsTable.id eq source }
        MergeOutcome.Merged(BookAuthor(targetId, VocabularyName(targetRow[BookAuthorsTable.name])))
    }

    /** Test seam, see [ExposedNameVocabulary.create]. */
    internal suspend fun create(name: VocabularyName, afterInitialLookup: () -> Unit): VocabularyCreation<BookAuthor> =
        vocabulary.create(name, afterInitialLookup)

    /** Test seam, see [ExposedNameVocabulary.rename]. */
    internal suspend fun rename(
        id: BookAuthorId,
        name: VocabularyName,
        afterLookup: () -> Unit,
    ): RenameOutcome<BookAuthor> = vocabulary.rename(id.toString(), name, afterLookup)
}
