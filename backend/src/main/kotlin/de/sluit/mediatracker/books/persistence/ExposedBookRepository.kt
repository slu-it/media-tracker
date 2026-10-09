package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.domain.Book
import de.sluit.mediatracker.books.domain.BookAuthor
import de.sluit.mediatracker.books.domain.BookAuthorId
import de.sluit.mediatracker.books.domain.BookFilters
import de.sluit.mediatracker.books.domain.BookId
import de.sluit.mediatracker.books.domain.BookMissingField
import de.sluit.mediatracker.books.domain.BookNarrator
import de.sluit.mediatracker.books.domain.BookNarratorId
import de.sluit.mediatracker.books.domain.BookOwnership
import de.sluit.mediatracker.books.domain.BookProgress
import de.sluit.mediatracker.books.domain.BookRepository
import de.sluit.mediatracker.books.domain.BookSeries
import de.sluit.mediatracker.books.domain.BookSeriesEntry
import de.sluit.mediatracker.books.domain.BookSeriesId
import de.sluit.mediatracker.books.domain.BookSeriesPosition
import de.sluit.mediatracker.books.domain.BookType
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.books.domain.BookTypeLabel
import de.sluit.mediatracker.books.domain.sortedByNameForBook
import de.sluit.mediatracker.books.domain.sortedForBook
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.persistence.TitleSearch
import de.sluit.mediatracker.common.persistence.dbQuery
import de.sluit.mediatracker.common.persistence.inListIfAny
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.compoundAnd
import org.jetbrains.exposed.v1.core.compoundOr
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.inSubQuery
import org.jetbrains.exposed.v1.core.innerJoin
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.statements.UpdateBuilder
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import kotlin.uuid.Uuid

/** [BookRepository] on Exposed/JDBC. Maps rows to domain objects and back; nothing else knows the table. */
class ExposedBookRepository : BookRepository {
    override suspend fun insert(book: Book) {
        dbQuery {
            BooksTable.insert { it.writeBook(book) }
            insertTypeLinks(book)
            insertAuthorLinks(book)
            insertNarratorLinks(book)
            insertSeriesLinks(book)
        }
    }

    override suspend fun findById(id: BookId): Book? = dbQuery {
        BooksTable.selectAll().where { BooksTable.id eq id.toString() }.singleOrNull()?.let { row ->
            row.toBook(
                typesFor(setOf(id.toString()))[id.toString()].orEmpty().sortedForBook(),
                authorsFor(setOf(id.toString()))[id.toString()].orEmpty().sortedByNameForBook(),
                narratorsFor(setOf(id.toString()))[id.toString()].orEmpty().sortedByNameForBook(),
                seriesFor(setOf(id.toString()))[id.toString()].orEmpty().sortedByNameForBook(),
            )
        }
    }

    override suspend fun exists(id: BookId): Boolean = dbQuery {
        BooksTable.select(BooksTable.id).where { BooksTable.id eq id.toString() }.limit(1).any()
    }

    override suspend fun update(book: Book): Boolean = dbQuery {
        val updated = BooksTable.update({ BooksTable.id eq book.id.toString() }) { it.writeBook(book) } == 1
        if (updated) {
            BookToTypeTable.deleteWhere { BookToTypeTable.bookId eq book.id.toString() }
            insertTypeLinks(book)
            BookToAuthorTable.deleteWhere { BookToAuthorTable.bookId eq book.id.toString() }
            insertAuthorLinks(book)
            BookToNarratorTable.deleteWhere { BookToNarratorTable.bookId eq book.id.toString() }
            insertNarratorLinks(book)
            BookToSeriesTable.deleteWhere { BookToSeriesTable.bookId eq book.id.toString() }
            insertSeriesLinks(book)
        }
        updated
    }

    override suspend fun deleteById(id: BookId): Int = dbQuery {
        // The FKs on the junction tables cascade on delete; no explicit junction cleanup needed.
        BooksTable.deleteWhere { BooksTable.id eq id.toString() }
    }

    override suspend fun findPage(request: PageRequest): Page<Book> = dbQuery {
        val total = BooksTable.selectAll().count()
        val rows = BooksTable.selectAll()
            .orderBy(BooksTable.title to SortOrder.ASC, BooksTable.id to SortOrder.ASC)
            .limit(request.size.value)
            .offset(request.offset)
            .toList()
        pageOf(rows, request, total)
    }

    /**
     * Six SELECTs: the total match count, the page of books, and one join query each for the types, authors,
     * narrators and series of every book on the page. [filters] AND across categories, OR (IN) inside one; combined with
     * [term]'s title match, if any, by AND as well. Without a [term] (or one that the fulltext parser strips
     * down to nothing, e.g. `"+++"`), the ordering is title then id, same as [findPage] - filters must not
     * silently vanish in that case, so this falls back to the filtered listing rather than [findPage]. A term
     * matches the title only: a title fulltext hit or a `title LIKE 'term%'` prefix match (escaped, see
     * [TitleSearch]; it finds titles InnoDB does not index, such as those under three characters or stopwords).
     * Prefix hits come first, then fulltext relevance, then title, then id. Fulltext entries become visible
     * once the inserting transaction commits.
     */
    override suspend fun search(term: SearchTerm?, filters: BookFilters, request: PageRequest): Page<Book> = dbQuery {
        // Built inside the transaction: LikePattern.ofLiteral reads the current dialect.
        val titleSearch = TitleSearch.of(BooksTable.title, term)
        if (titleSearch == null) {
            // No term (or nothing left of one): the same predicate feeds both the count and the page
            // query, built once here so the two `.where` calls below share the identical Op instance.
            val predicate = filterOp(filters) ?: Op.TRUE
            val total = BooksTable.selectAll().where { predicate }.count()
            val rows = BooksTable.selectAll().where { predicate }
                .orderBy(BooksTable.title to SortOrder.ASC, BooksTable.id to SortOrder.ASC)
                .limit(request.size.value)
                .offset(request.offset)
                .toList()
            pageOf(rows, request, total)
        } else {
            // matches is an OrOp; compoundAnd() parenthesises it inside the AndOp automatically.
            val predicate = listOfNotNull(titleSearch.matches, filterOp(filters)).compoundAnd()
            val total = BooksTable.selectAll().where { predicate }.count()
            val ordering = (
                titleSearch.relevanceOrdering() +
                    listOf(BooksTable.title to SortOrder.ASC, BooksTable.id to SortOrder.ASC)
                ).toTypedArray()
            val rows = BooksTable.select(BooksTable.columns + titleSearch.score).where { predicate }
                .orderBy(*ordering)
                .limit(request.size.value)
                .offset(request.offset)
                .toList()
            pageOf(rows, request, total)
        }
    }

    /**
     * `null` when nothing is filtered; AND across the categories, OR (IN) inside one. The type filter is an
     * uncorrelated `IN` subquery rather than an `innerJoin`: a book of two selected types would otherwise come
     * back twice and corrupt both `count()` and the LIMIT/OFFSET window, and MariaDB can still read the inner
     * side straight off `idx_book_to_type_type`. The `missing` category ORs `IS NULL` checks over the listed
     * [BookMissingField]s instead of an `IN` list.
     */
    private fun filterOp(filters: BookFilters): Op<Boolean>? = buildList {
        filters.typeIds.takeIf { it.isNotEmpty() }?.let { ids ->
            add(
                BooksTable.id inSubQuery BookToTypeTable
                    .select(BookToTypeTable.bookId)
                    .where { BookToTypeTable.typeId inList ids.map { it.toString() } },
            )
        }
        // inListIfAny skips an empty set: inList(emptyList()) would render FALSE and return zero rows.
        BooksTable.ownership.inListIfAny(filters.ownership.map(BookOwnership::wire))?.let { add(it) }
        BooksTable.progress.inListIfAny(filters.progress.map(BookProgress::wire))?.let { add(it) }
        BooksTable.releaseYear.inListIfAny(filters.releaseYears.map { y -> y.value })?.let { add(it) }
        filters.missing.takeIf { it.isNotEmpty() }?.let { fields -> add(fields.map(::missingOp).compoundOr()) }
    }.takeIf { it.isNotEmpty() }?.compoundAnd()

    /** `IS NULL` is the whole test: `Description` forbids a blank value, so a stored text is never empty. */
    private fun missingOp(field: BookMissingField): Op<Boolean> = when (field) {
        BookMissingField.DESCRIPTION -> BooksTable.description.isNull()
        BookMissingField.COVER_IMAGE_URL -> BooksTable.coverImageUrl.isNull()
    }

    /** Four DISTINCT selects in one transaction; see [BookRepository.findUsedFilterValues]. */
    override suspend fun findUsedFilterValues(): BookFilters = dbQuery {
        val typeIds = BookToTypeTable.select(BookToTypeTable.typeId).withDistinct()
            .map { BookTypeId.parse(it[BookToTypeTable.typeId]) }
            .toSet()
        val ownership = BooksTable.select(BooksTable.ownership).withDistinct()
            .map { BookOwnership.from(it[BooksTable.ownership]) }
            .toSet()
        val progress = BooksTable.select(BooksTable.progress).withDistinct()
            .map { BookProgress.from(it[BooksTable.progress]) }
            .toSet()
        val releaseYears = BooksTable.select(BooksTable.releaseYear).withDistinct()
            .map { ReleaseYear(it[BooksTable.releaseYear]) }
            .toSet()
        BookFilters(typeIds, ownership, progress, releaseYears)
    }

    /**
     * One SELECT of the series' books (inner join on the link table), ordered by `position IS NULL` first
     * (MariaDB has no `NULLS LAST`; a plain ASC sort puts NULLs first), then position, title and id; then the
     * shared batch loaders, so the query count is constant.
     */
    override suspend fun findBySeries(seriesId: BookSeriesId): List<Book> = dbQuery {
        val rows = (BooksTable innerJoin BookToSeriesTable)
            .select(BooksTable.columns)
            .where { BookToSeriesTable.seriesId eq seriesId.toString() }
            .orderBy(
                BookToSeriesTable.position.isNull() to SortOrder.ASC,
                BookToSeriesTable.position to SortOrder.ASC,
                BooksTable.title to SortOrder.ASC,
                BooksTable.id to SortOrder.ASC,
            )
            .toList()
        hydrate(rows)
    }

    /**
     * One SELECT of the author's books (inner join on the link table), ordered by release year, then
     * `release_date IS NULL` (MariaDB has no `NULLS LAST`; a plain ASC sort puts NULLs first, so undated books
     * come last within a year), release date, title and id; then the shared batch loaders, so the query count
     * is constant.
     */
    override suspend fun findByAuthor(authorId: BookAuthorId): List<Book> = dbQuery {
        val rows = (BooksTable innerJoin BookToAuthorTable)
            .select(BooksTable.columns)
            .where { BookToAuthorTable.authorId eq authorId.toString() }
            .orderBy(
                BooksTable.releaseYear to SortOrder.ASC,
                BooksTable.releaseDate.isNull() to SortOrder.ASC,
                BooksTable.releaseDate to SortOrder.ASC,
                BooksTable.title to SortOrder.ASC,
                BooksTable.id to SortOrder.ASC,
            )
            .toList()
        hydrate(rows)
    }

    private fun pageOf(rows: List<ResultRow>, request: PageRequest, total: Long): Page<Book> =
        Page(hydrate(rows), request.page, request.size, total)

    /**
     * Maps rows (with or without the extra `score` column) to [Book]s, loading types and
     * authors, narrators and series with one join query each, regardless of row count.
     */
    private fun hydrate(rows: List<ResultRow>): List<Book> {
        val bookIds = rows.map { it[BooksTable.id] }.toSet()
        val typesByBook = typesFor(bookIds)
        val authorsByBook = authorsFor(bookIds)
        val narratorsByBook = narratorsFor(bookIds)
        val seriesByBook = seriesFor(bookIds)
        return rows.map { row ->
            row.toBook(
                typesByBook[row[BooksTable.id]].orEmpty().sortedForBook(),
                authorsByBook[row[BooksTable.id]].orEmpty().sortedByNameForBook(),
                narratorsByBook[row[BooksTable.id]].orEmpty().sortedByNameForBook(),
                seriesByBook[row[BooksTable.id]].orEmpty().sortedByNameForBook(),
            )
        }
    }

    /** One query for all requested book ids: no N+1 when loading a page of books. */
    private fun typesFor(bookIds: Set<String>): Map<String, List<BookType>> {
        if (bookIds.isEmpty()) return emptyMap()
        return (BookToTypeTable innerJoin BookTypesTable)
            .select(
                BookToTypeTable.bookId,
                BookTypesTable.id,
                BookTypesTable.label,
                BookTypesTable.associatedColor,
            )
            .where { BookToTypeTable.bookId inList bookIds }
            .groupBy({ it[BookToTypeTable.bookId] }, { it.toBookType() })
    }

    /** One query for all requested book ids: no N+1 when loading a page of books. */
    private fun authorsFor(bookIds: Set<String>): Map<String, List<BookAuthor>> {
        if (bookIds.isEmpty()) return emptyMap()
        return (BookToAuthorTable innerJoin BookAuthorsTable)
            .select(BookToAuthorTable.bookId, BookAuthorsTable.id, BookAuthorsTable.name)
            .where { BookToAuthorTable.bookId inList bookIds }
            .groupBy({ it[BookToAuthorTable.bookId] }, { it.toBookAuthor() })
    }

    /** One query for all requested book ids: no N+1 when loading a page of books. */
    private fun narratorsFor(bookIds: Set<String>): Map<String, List<BookNarrator>> {
        if (bookIds.isEmpty()) return emptyMap()
        return (BookToNarratorTable innerJoin BookNarratorsTable)
            .select(BookToNarratorTable.bookId, BookNarratorsTable.id, BookNarratorsTable.name)
            .where { BookToNarratorTable.bookId inList bookIds }
            .groupBy({ it[BookToNarratorTable.bookId] }, { it.toBookNarrator() })
    }

    /** One query for all requested book ids: no N+1 when loading a page of books. */
    private fun seriesFor(bookIds: Set<String>): Map<String, List<BookSeriesEntry>> {
        if (bookIds.isEmpty()) return emptyMap()
        return (BookToSeriesTable innerJoin BookSeriesTable)
            .select(
                BookToSeriesTable.bookId,
                BookSeriesTable.id,
                BookSeriesTable.name,
                BookToSeriesTable.position,
            )
            .where { BookToSeriesTable.bookId inList bookIds }
            .groupBy({ it[BookToSeriesTable.bookId] }, { it.toBookSeriesEntry() })
    }

    private fun insertTypeLinks(book: Book) {
        BookToTypeTable.batchInsert(book.types) { type ->
            this[BookToTypeTable.bookId] = book.id.toString()
            this[BookToTypeTable.typeId] = type.id.toString()
        }
    }

    private fun insertAuthorLinks(book: Book) {
        BookToAuthorTable.batchInsert(book.authors) { author ->
            this[BookToAuthorTable.bookId] = book.id.toString()
            this[BookToAuthorTable.authorId] = author.id.toString()
        }
    }

    private fun insertNarratorLinks(book: Book) {
        BookToNarratorTable.batchInsert(book.narrators) { narrator ->
            this[BookToNarratorTable.bookId] = book.id.toString()
            this[BookToNarratorTable.narratorId] = narrator.id.toString()
        }
    }

    private fun insertSeriesLinks(book: Book) {
        BookToSeriesTable.batchInsert(book.series) { entry ->
            this[BookToSeriesTable.bookId] = book.id.toString()
            this[BookToSeriesTable.seriesId] = entry.series.id.toString()
            this[BookToSeriesTable.position] = entry.position?.value?.setScale(BookSeriesPosition.MAX_SCALE)
        }
    }

    private fun UpdateBuilder<*>.writeBook(book: Book) {
        this[BooksTable.id] = book.id.toString()
        this[BooksTable.title] = book.title.value
        this[BooksTable.releaseYear] = book.releaseYear.value
        this[BooksTable.releaseDate] = book.releaseDate?.value
        this[BooksTable.description] = book.description?.value
        this[BooksTable.coverImageUrl] = book.coverImageUrl?.value
        this[BooksTable.ownership] = book.ownership.wire
        this[BooksTable.progress] = book.progress.wire
    }

    private fun ResultRow.toBookType() = BookType(
        id = BookTypeId(Uuid.parseHexDash(this[BookTypesTable.id])),
        label = BookTypeLabel(this[BookTypesTable.label]),
        color = HexColor(this[BookTypesTable.associatedColor]),
    )

    private fun ResultRow.toBookAuthor() = BookAuthor(
        id = BookAuthorId(Uuid.parseHexDash(this[BookAuthorsTable.id])),
        name = VocabularyName(this[BookAuthorsTable.name]),
    )

    private fun ResultRow.toBookNarrator() = BookNarrator(
        id = BookNarratorId(Uuid.parseHexDash(this[BookNarratorsTable.id])),
        name = VocabularyName(this[BookNarratorsTable.name]),
    )

    private fun ResultRow.toBookSeriesEntry() = BookSeriesEntry(
        series = BookSeries(
            id = BookSeriesId(Uuid.parseHexDash(this[BookSeriesTable.id])),
            name = VocabularyName(this[BookSeriesTable.name]),
        ),
        position = this[BookToSeriesTable.position]?.let(BookSeriesPosition::of),
    )

    // Re-running the value-object validation on read is intentional: a corrupt row surfaces as a 400
    // validation_error instead of leaking invalid data into the domain.
    private fun ResultRow.toBook(
        types: List<BookType>,
        authors: List<BookAuthor>,
        narrators: List<BookNarrator>,
        series: List<BookSeriesEntry>,
    ) = Book(
        id = BookId(Uuid.parseHexDash(this[BooksTable.id])),
        title = Title(this[BooksTable.title]),
        releaseYear = ReleaseYear(this[BooksTable.releaseYear]),
        types = types,
        authors = authors,
        narrators = narrators,
        series = series,
        description = this[BooksTable.description]?.let(::Description),
        coverImageUrl = this[BooksTable.coverImageUrl]?.let(::CoverImageUrl),
        ownership = BookOwnership.from(this[BooksTable.ownership]),
        progress = BookProgress.from(this[BooksTable.progress]),
        releaseDate = this[BooksTable.releaseDate]?.let(::ReleaseDate),
    )
}
