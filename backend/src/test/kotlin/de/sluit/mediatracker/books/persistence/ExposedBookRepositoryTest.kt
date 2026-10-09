package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.BookTypes
import de.sluit.mediatracker.books.book
import de.sluit.mediatracker.books.domain.BookFilters
import de.sluit.mediatracker.books.domain.BookId
import de.sluit.mediatracker.books.domain.BookMissingField
import de.sluit.mediatracker.books.domain.BookOwnership
import de.sluit.mediatracker.books.domain.BookProgress
import de.sluit.mediatracker.books.domain.BookSort
import de.sluit.mediatracker.books.seriesEntry
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.persistence.countStatements
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.time.LocalDate
import java.util.TimeZone
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ExposedBookRepositoryTest {

    @Test
    fun `insert then findById round-trips a book without types and authors`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val inserted = book("Dune")
        repo.insert(inserted)

        val found = repo.findById(inserted.id)

        assertEquals(inserted, found)
        assertEquals(emptyList(), found?.types)
    }

    @Test
    fun `insert then findById round-trips two types sorted by label`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val inserted = book("Dune", types = listOf(BookTypes.PAPERBACK, BookTypes.HARDCOVER))
        repo.insert(inserted)

        val found = repo.findById(inserted.id)

        assertEquals(listOf("Hardcover", "Paperback"), found?.types?.map { it.label.value })
        assertEquals(inserted, found)
    }

    @Test
    fun `insert round-trips description cover image url ownership and progress`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val inserted = book(
            "Dune",
            description = Description("A desert planet."),
            coverImageUrl = CoverImageUrl("https://example.com/dune.jpg"),
            ownership = BookOwnership.OWNED,
            progress = BookProgress.READING,
        )
        repo.insert(inserted)

        assertEquals(inserted, repo.findById(inserted.id))
    }

    @Test
    fun `insert stores absent optional fields as null`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val inserted = book("Dune")
        repo.insert(inserted)

        val row = transaction { BooksTable.selectAll().where { BooksTable.id eq inserted.id.toString() }.single() }

        assertNull(row[BooksTable.description])
        assertNull(row[BooksTable.coverImageUrl])
        assertNull(row[BooksTable.releaseDate])
    }

    @Test
    fun `findById of an unknown id returns null`() = withFreshDatabase {
        assertNull(ExposedBookRepository().findById(BookId.new()))
    }

    @Test
    fun `exists is true for a stored book and false for an unknown id`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val inserted = book("Dune")
        repo.insert(inserted)

        assertTrue(repo.exists(inserted.id))
        assertEquals(false, repo.exists(BookId.new()))
    }

    @Test
    fun `insert then findById returns the book with authors sorted by name`() = withFreshDatabase {
        val authorRepo = ExposedBookAuthorRepository()
        val herbert = authorRepo.create(VocabularyName("Frank Herbert")).entry
        val adams = authorRepo.create(VocabularyName("Douglas Adams")).entry
        val repo = ExposedBookRepository()
        val inserted = book("Collaboration", authors = listOf(herbert, adams))
        repo.insert(inserted)

        val found = repo.findById(inserted.id)

        assertEquals(listOf(adams, herbert), found?.authors)
    }

    @Test
    fun `insert then findById returns the book with narrators sorted by name`() = withFreshDatabase {
        val narratorRepo = ExposedBookNarratorRepository()
        val zed = narratorRepo.create(VocabularyName("Zed Reader")).entry
        val able = narratorRepo.create(VocabularyName("Able Reader")).entry
        val repo = ExposedBookRepository()
        val inserted = book("Audio", narrators = listOf(zed, able))
        repo.insert(inserted)

        assertEquals(listOf(able, zed), repo.findById(inserted.id)?.narrators)
    }

    @Test
    fun `insert then findById round-trips series with and without a position sorted by series name`() =
        withFreshDatabase {
            val seriesRepo = ExposedBookSeriesRepository()
            val cosmere = seriesRepo.create(VocabularyName("The Cosmere")).entry
            val mistborn = seriesRepo.create(VocabularyName("Mistborn")).entry
            val repo = ExposedBookRepository()
            val inserted = book("The Final Empire", series = listOf(seriesEntry(cosmere), seriesEntry(mistborn, 2.5)))
            repo.insert(inserted)

            val found = repo.findById(inserted.id)

            assertEquals(listOf(seriesEntry(mistborn, 2.5), seriesEntry(cosmere)), found?.series)
            assertEquals(inserted, found)
        }

    @Test
    fun `a series position at the column limits and zero round-trips`() = withFreshDatabase {
        val seriesRepo = ExposedBookSeriesRepository()
        val a = seriesRepo.create(VocabularyName("A")).entry
        val b = seriesRepo.create(VocabularyName("B")).entry
        val c = seriesRepo.create(VocabularyName("C")).entry
        val repo = ExposedBookRepository()
        val inserted = book("Edge", series = listOf(seriesEntry(a, 0.0), seriesEntry(b, 9999.99), seriesEntry(c, 10.0)))
        repo.insert(inserted)

        assertEquals(inserted, repo.findById(inserted.id))
    }

    // release date

    @Test
    fun `insert round-trips a release date and stores the matching release year`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val inserted = book("Dune", releaseDate = ReleaseDate(LocalDate.of(1965, 8, 1)))
        repo.insert(inserted)

        val found = repo.findById(inserted.id)

        assertEquals(ReleaseDate(LocalDate.of(1965, 8, 1)), found?.releaseDate)
        assertEquals(ReleaseYear(1965), found?.releaseYear)
    }

    @Test
    fun `release date round-trips regardless of the JVM's default timezone`() {
        // Same pathological case as the games test: LocalDateColumnType must not depend on any zone.
        val originalDefault = TimeZone.getDefault()
        try {
            listOf("Pacific/Kiritimati", "Pacific/Pago_Pago").forEach { zoneId ->
                TimeZone.setDefault(TimeZone.getTimeZone(zoneId))
                withFreshDatabase {
                    val repo = ExposedBookRepository()
                    val releaseDate = ReleaseDate(LocalDate.of(1965, 8, 1))
                    val inserted = book("Dune $zoneId", releaseDate = releaseDate)
                    repo.insert(inserted)

                    assertEquals(releaseDate, repo.findById(inserted.id)?.releaseDate)
                }
            }
        } finally {
            TimeZone.setDefault(originalDefault)
        }
    }

    // findPage

    @Test
    fun `findPage orders by title then id and reports totals`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val first = book("A", id = BookId.parse("00000000-0000-0000-0000-000000000001"))
        val second = book("A", id = BookId.parse("00000000-0000-0000-0000-000000000002"))
        val c = book("C")
        repo.insert(c)
        repo.insert(second)
        repo.insert(first)

        val page = repo.findPage(PageRequest())

        assertEquals(listOf(first.id, second.id, c.id), page.items.map { it.id })
        assertEquals(3, page.totalItems)
        assertEquals(1, page.totalPages)
    }

    @Test
    fun `findPage applies offset and limit`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        (1..5).forEach { repo.insert(book("B$it")) }

        val page = repo.findPage(PageRequest(page = PageNumber(2), size = PageSize(2)))

        assertEquals(listOf("B3", "B4"), page.items.map { it.title.value })
        assertEquals(5, page.totalItems)
        assertEquals(3, page.totalPages)
    }

    @Test
    fun `findPage returns the last partial page`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        (1..5).forEach { repo.insert(book("B$it")) }

        val page = repo.findPage(PageRequest(page = PageNumber(3), size = PageSize(2)))

        assertEquals(listOf("B5"), page.items.map { it.title.value })
        assertEquals(5, page.totalItems)
    }

    @Test
    fun `findPage beyond the end returns no items but the totals`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        (1..5).forEach { repo.insert(book("B$it")) }

        val page = repo.findPage(PageRequest(page = PageNumber(4), size = PageSize(2)))

        assertTrue(page.items.isEmpty())
        assertEquals(5, page.totalItems)
        assertEquals(3, page.totalPages)
    }

    @Test
    fun `findPage on an empty table has zero items and zero pages`() = withFreshDatabase {
        val page = ExposedBookRepository().findPage(PageRequest())

        assertTrue(page.items.isEmpty())
        assertEquals(0, page.totalItems)
        assertEquals(0, page.totalPages)
    }

    @Test
    fun `findPage loads the types and authors of a page with a constant number of queries`() = withFreshDatabase { db ->
        val herbert = ExposedBookAuthorRepository().create(VocabularyName("Frank Herbert")).entry
        val reader = ExposedBookNarratorRepository().create(VocabularyName("A Reader")).entry
        val dune = ExposedBookSeriesRepository().create(VocabularyName("Dune Chronicles")).entry
        val inSeries = listOf(seriesEntry(dune, 1.5))
        val repo = ExposedBookRepository()
        val twoTypes = listOf(BookTypes.HARDCOVER, BookTypes.KINDLE)
        (1..2).forEach {
            repo.insert(
                book(
                    "B$it",
                    types = twoTypes,
                    authors = listOf(herbert),
                    narrators = listOf(reader),
                    series = inSeries,
                ),
            )
        }

        val countWithTwoBooks = countStatements(db.database) { repo.findPage(PageRequest()) }

        (3..5).forEach {
            repo.insert(
                book(
                    "B$it",
                    types = twoTypes,
                    authors = listOf(herbert),
                    narrators = listOf(reader),
                    series = inSeries,
                ),
            )
        }
        val countWithFiveBooks = countStatements(db.database) { repo.findPage(PageRequest()) }

        // Exactly six SELECT statements regardless of page size: the total count, the page of books, and one
        // join query each that loads every book's types, authors, narrators and series at once.
        assertEquals(6, countWithTwoBooks)
        assertEquals(countWithTwoBooks, countWithFiveBooks)
    }

    // update and delete

    @Test
    fun `update replaces the row and its type links exactly`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val original = book("Dune", types = listOf(BookTypes.PAPERBACK, BookTypes.HARDCOVER))
        repo.insert(original)

        val updated = original.copy(title = Title("Dune (updated)"), types = listOf(BookTypes.KINDLE))
        val result = repo.update(updated)

        assertTrue(result)
        val found = repo.findById(original.id)
        assertEquals("Dune (updated)", found?.title?.value)
        assertEquals(listOf(BookTypes.KINDLE), found?.types)
        val linkCount = transaction {
            BookToTypeTable.selectAll().where { BookToTypeTable.bookId eq original.id.toString() }.count()
        }
        assertEquals(1, linkCount)
    }

    @Test
    fun `update clears the type links when the book has none anymore`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val original = book("Dune", types = listOf(BookTypes.PAPERBACK))
        repo.insert(original)

        repo.update(original.copy(types = emptyList()))

        assertEquals(emptyList(), repo.findById(original.id)?.types)
    }

    @Test
    fun `update replaces the author links exactly`() = withFreshDatabase {
        val authorRepo = ExposedBookAuthorRepository()
        val herbert = authorRepo.create(VocabularyName("Frank Herbert")).entry
        val adams = authorRepo.create(VocabularyName("Douglas Adams")).entry
        val repo = ExposedBookRepository()
        val original = book("Dune", authors = listOf(herbert))
        repo.insert(original)

        val result = repo.update(original.copy(authors = listOf(adams)))

        assertTrue(result)
        assertEquals(listOf(adams), repo.findById(original.id)?.authors)
        val linkCount = transaction {
            BookToAuthorTable.selectAll().where { BookToAuthorTable.bookId eq original.id.toString() }.count()
        }
        assertEquals(1, linkCount)
    }

    @Test
    fun `update replaces the narrator links exactly`() = withFreshDatabase {
        val narratorRepo = ExposedBookNarratorRepository()
        val first = narratorRepo.create(VocabularyName("First")).entry
        val second = narratorRepo.create(VocabularyName("Second")).entry
        val repo = ExposedBookRepository()
        val original = book("Audio", narrators = listOf(first))
        repo.insert(original)

        assertTrue(repo.update(original.copy(narrators = listOf(second))))

        assertEquals(listOf(second), repo.findById(original.id)?.narrators)
        val linkCount = transaction {
            BookToNarratorTable.selectAll().where { BookToNarratorTable.bookId eq original.id.toString() }.count()
        }
        assertEquals(1, linkCount)
    }

    @Test
    fun `update replaces the series links and positions exactly`() = withFreshDatabase {
        val seriesRepo = ExposedBookSeriesRepository()
        val mistborn = seriesRepo.create(VocabularyName("Mistborn")).entry
        val cosmere = seriesRepo.create(VocabularyName("The Cosmere")).entry
        val repo = ExposedBookRepository()
        val original = book("The Final Empire", series = listOf(seriesEntry(mistborn, 1.0)))
        repo.insert(original)

        assertTrue(repo.update(original.copy(series = listOf(seriesEntry(mistborn, 2.5), seriesEntry(cosmere)))))

        assertEquals(
            listOf(seriesEntry(mistborn, 2.5), seriesEntry(cosmere)),
            repo.findById(original.id)?.series,
        )
        val linkCount = transaction {
            BookToSeriesTable.selectAll().where { BookToSeriesTable.bookId eq original.id.toString() }.count()
        }
        assertEquals(2, linkCount)
    }

    @Test
    fun `update clears the series links when the book has none anymore`() = withFreshDatabase {
        val mistborn = ExposedBookSeriesRepository().create(VocabularyName("Mistborn")).entry
        val repo = ExposedBookRepository()
        val original = book("The Final Empire", series = listOf(seriesEntry(mistborn, 1.0)))
        repo.insert(original)

        repo.update(original.copy(series = emptyList()))

        assertEquals(emptyList(), repo.findById(original.id)?.series)
    }

    @Test
    fun `update clears optional fields set to null`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val original = book(
            "Dune",
            description = Description("desc"),
            coverImageUrl = CoverImageUrl("https://example.com/dune.jpg"),
            releaseDate = ReleaseDate(LocalDate.of(1965, 8, 1)),
        )
        repo.insert(original)

        repo.update(original.copy(description = null, coverImageUrl = null, releaseDate = null))

        val found = repo.findById(original.id)
        assertNull(found?.description)
        assertNull(found?.coverImageUrl)
        assertNull(found?.releaseDate)
    }

    @Test
    fun `update changes ownership and progress`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val original = book("Dune")
        repo.insert(original)

        repo.update(original.copy(ownership = BookOwnership.OWNED, progress = BookProgress.FINISHED))

        val found = repo.findById(original.id)
        assertEquals(BookOwnership.OWNED, found?.ownership)
        assertEquals(BookProgress.FINISHED, found?.progress)
    }

    @Test
    fun `update of an unknown id returns false and writes nothing`() = withFreshDatabase {
        val repo = ExposedBookRepository()

        val result = repo.update(book("Ghost", types = listOf(BookTypes.KINDLE)))

        assertEquals(false, result)
        assertEquals(0, repo.findPage(PageRequest()).totalItems)
        assertEquals(0, transaction { BookToTypeTable.selectAll().count() })
    }

    @Test
    fun `deleteById returns 1 then 0`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val inserted = book("Dune")
        repo.insert(inserted)

        assertEquals(1, repo.deleteById(inserted.id))
        assertEquals(0, repo.deleteById(inserted.id))
    }

    @Test
    fun `deleteById cascades to the narrator and series links but keeps the vocabulary`() = withFreshDatabase {
        val reader = ExposedBookNarratorRepository().create(VocabularyName("A Reader")).entry
        val mistborn = ExposedBookSeriesRepository().create(VocabularyName("Mistborn")).entry
        val repo = ExposedBookRepository()
        val inserted = book("Dune", narrators = listOf(reader), series = listOf(seriesEntry(mistborn, 1.0)))
        repo.insert(inserted)

        repo.deleteById(inserted.id)

        transaction {
            assertEquals(0, BookToNarratorTable.selectAll().count())
            assertEquals(0, BookToSeriesTable.selectAll().count())
            assertEquals(1, BookNarratorsTable.selectAll().count())
            assertEquals(1, BookSeriesTable.selectAll().count())
        }
    }

    @Test
    fun `deleteById cascades to the type and author links`() = withFreshDatabase {
        val herbert = ExposedBookAuthorRepository().create(VocabularyName("Frank Herbert")).entry
        val repo = ExposedBookRepository()
        val inserted = book("Dune", types = listOf(BookTypes.PAPERBACK, BookTypes.KINDLE), authors = listOf(herbert))
        repo.insert(inserted)

        repo.deleteById(inserted.id)

        val typeLinks = transaction {
            BookToTypeTable.selectAll().where { BookToTypeTable.bookId eq inserted.id.toString() }.count()
        }
        val authorLinks = transaction {
            BookToAuthorTable.selectAll().where { BookToAuthorTable.bookId eq inserted.id.toString() }.count()
        }
        assertEquals(0, typeLinks)
        assertEquals(0, authorLinks)
    }

    // search

    @Test
    fun `search matches any word`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val dune = book("Dune")
        val emma = book("Emma")
        repo.insert(dune)
        repo.insert(emma)

        val page = repo.search(SearchTerm("dune emma"), BookFilters.NONE, PageRequest())

        assertEquals(setOf(dune.id, emma.id), page.items.map { it.id }.toSet())
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `search matches a word prefix`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val hobbit = book("The Hobbit")
        repo.insert(hobbit)
        repo.insert(book("Dune"))

        val page = repo.search(SearchTerm("hob"), BookFilters.NONE, PageRequest())

        assertEquals(listOf(hobbit.id), page.items.map { it.id })
    }

    @Test
    fun `search finds a title too short for the fulltext index`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val short = book("It")
        repo.insert(short)
        repo.insert(book("Dune"))

        val page = repo.search(SearchTerm("it"), BookFilters.NONE, PageRequest())

        assertEquals(listOf(short.id), page.items.map { it.id })
    }

    @Test
    fun `search ignores the description`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        repo.insert(book("Underworld", description = Description("a procedural story about the underworld")))
        val titleHit = book("Procedural Poetry")
        repo.insert(titleHit)

        val descriptionPage = repo.search(SearchTerm("underworld"), BookFilters.NONE, PageRequest())
        val titlePage = repo.search(SearchTerm("procedural"), BookFilters.NONE, PageRequest())

        assertEquals(1, descriptionPage.totalItems)
        assertEquals(listOf(titleHit.id), titlePage.items.map { it.id })
    }

    @Test
    fun `search ranks a title prefix hit above a fulltext only hit`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val midTitle = book("A Dark Place")
        val prefix = book("Dark Tower")
        repo.insert(midTitle)
        repo.insert(prefix)
        repo.insert(book("Emma"))

        val page = repo.search(SearchTerm("dark"), BookFilters.NONE, PageRequest())

        assertEquals(listOf(prefix.id, midTitle.id), page.items.map { it.id })
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `search treats percent and underscore in the term literally`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val literal = book("a_c story")
        repo.insert(literal)
        repo.insert(book("abc story"))
        repo.insert(book("50% Off"))
        repo.insert(book("50 Days"))

        val underscore = repo.search(SearchTerm("a_c"), BookFilters.NONE, PageRequest())
        val percent = repo.search(SearchTerm("50%"), BookFilters.NONE, PageRequest())

        assertEquals(listOf(literal.id), underscore.items.map { it.id })
        assertEquals(listOf("50% Off"), percent.items.map { it.title.value })
    }

    @Test
    fun `search orders equal scores by title then id`() = withFreshDatabase {
        val beta = book("Dune Beta")
        val alpha = book("Dune Alpha")
        val gammaFirst = book("Dune Gamma", id = BookId.parse("00000000-0000-0000-0000-000000000001"))
        val gammaSecond = book("Dune Gamma", id = BookId.parse("00000000-0000-0000-0000-000000000002"))
        val repo = ExposedBookRepository()
        repo.insert(beta)
        repo.insert(alpha)
        repo.insert(gammaSecond)
        repo.insert(gammaFirst)

        val page = repo.search(SearchTerm("dune"), BookFilters.NONE, PageRequest())

        assertEquals(listOf(alpha.id, beta.id, gammaFirst.id, gammaSecond.id), page.items.map { it.id })
    }

    @Test
    fun `search reports totals and pages the ranked list`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        listOf("Dune One", "Dune Two", "Dune Three").forEach { repo.insert(book(it)) }

        val page = repo.search(SearchTerm("dune"), BookFilters.NONE, PageRequest(PageNumber(2), PageSize(2)))

        assertEquals(1, page.items.size)
        assertEquals(3, page.totalItems)
        assertEquals(2, page.totalPages)
    }

    @Test
    fun `a term stripped to nothing falls back to the filtered listing instead of dropping the filters`() =
        withFreshDatabase {
            val repo = ExposedBookRepository()
            val owned = book("Alpha", ownership = BookOwnership.OWNED)
            repo.insert(owned)
            repo.insert(book("Beta", ownership = BookOwnership.WATCHLIST))

            val page = repo.search(
                SearchTerm("+-*"),
                BookFilters(ownership = setOf(BookOwnership.OWNED)),
                PageRequest(),
            )

            assertEquals(listOf(owned.id), page.items.map { it.id })
            assertEquals(1, page.totalItems)
        }

    @Test
    fun `search loads the types and authors of a page with a constant number of queries`() = withFreshDatabase { db ->
        val herbert = ExposedBookAuthorRepository().create(VocabularyName("Frank Herbert")).entry
        val reader = ExposedBookNarratorRepository().create(VocabularyName("A Reader")).entry
        val dune = ExposedBookSeriesRepository().create(VocabularyName("Dune Chronicles")).entry
        val inSeries = listOf(seriesEntry(dune, 1.5))
        val repo = ExposedBookRepository()
        val twoTypes = listOf(BookTypes.HARDCOVER, BookTypes.KINDLE)
        (1..2).forEach {
            repo.insert(
                book(
                    "Dune $it",
                    types = twoTypes,
                    authors = listOf(herbert),
                    narrators = listOf(reader),
                    series = inSeries,
                ),
            )
        }

        val countWithTwoBooks = countStatements(db.database) {
            repo.search(SearchTerm("dune"), BookFilters.NONE, PageRequest())
        }

        (3..5).forEach {
            repo.insert(
                book(
                    "Dune $it",
                    types = twoTypes,
                    authors = listOf(herbert),
                    narrators = listOf(reader),
                    series = inSeries,
                ),
            )
        }
        val countWithFiveBooks = countStatements(db.database) {
            repo.search(SearchTerm("dune"), BookFilters.NONE, PageRequest())
        }

        assertEquals(6, countWithTwoBooks)
        assertEquals(countWithTwoBooks, countWithFiveBooks)
    }

    // search - filters

    @Test
    fun `two values in one filter match either book`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val notStarted = book("Alpha", progress = BookProgress.NOT_STARTED)
        val reading = book("Beta", progress = BookProgress.READING)
        val finished = book("Gamma", progress = BookProgress.FINISHED)
        listOf(notStarted, reading, finished).forEach { repo.insert(it) }

        val filters = BookFilters(progress = setOf(BookProgress.NOT_STARTED, BookProgress.READING))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(setOf(notStarted.id, reading.id), page.items.map { it.id }.toSet())
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `two different filters both have to match`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val matchesBoth = book("Alpha", ownership = BookOwnership.OWNED, progress = BookProgress.READING)
        val ownershipOnly = book("Beta", ownership = BookOwnership.OWNED, progress = BookProgress.FINISHED)
        val progressOnly = book("Gamma", ownership = BookOwnership.WATCHLIST, progress = BookProgress.READING)
        listOf(matchesBoth, ownershipOnly, progressOnly).forEach { repo.insert(it) }

        val filters = BookFilters(ownership = setOf(BookOwnership.OWNED), progress = setOf(BookProgress.READING))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(listOf(matchesBoth.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `release year filter matches only the listed years`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val y2010 = book("Alpha", releaseYear = 2010)
        val y2015 = book("Beta", releaseYear = 2015)
        val y2020 = book("Gamma", releaseYear = 2020)
        listOf(y2010, y2015, y2020).forEach { repo.insert(it) }

        val filters = BookFilters(releaseYears = setOf(ReleaseYear(2010), ReleaseYear(2020)))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(setOf(y2010.id, y2020.id), page.items.map { it.id }.toSet())
    }

    @Test
    fun `type filter matches books having any of the selected types`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val hardcover = book("Alpha", types = listOf(BookTypes.HARDCOVER))
        val kindle = book("Beta", types = listOf(BookTypes.KINDLE))
        val audible = book("Gamma", types = listOf(BookTypes.AUDIBLE))
        val untyped = book("Delta")
        listOf(hardcover, kindle, audible, untyped).forEach { repo.insert(it) }

        val filters = BookFilters(typeIds = setOf(BookTypes.HARDCOVER.id, BookTypes.KINDLE.id))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(setOf(hardcover.id, kindle.id), page.items.map { it.id }.toSet())
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `a book of two selected types is returned once and counted once`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val both = book("Dune", types = listOf(BookTypes.HARDCOVER, BookTypes.KINDLE))
        repo.insert(both)

        val filters = BookFilters(typeIds = setOf(BookTypes.HARDCOVER.id, BookTypes.KINDLE.id))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(listOf(both.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `filters narrow a fulltext search`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val owned = book("Dune", ownership = BookOwnership.OWNED)
        repo.insert(owned)
        repo.insert(book("Dune Messiah", ownership = BookOwnership.WATCHLIST))

        val filters = BookFilters(ownership = setOf(BookOwnership.OWNED))
        val page = repo.search(SearchTerm("dune"), filters, PageRequest())

        assertEquals(listOf(owned.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `a filter-only call is ordered by title`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val c = book("C", ownership = BookOwnership.OWNED)
        val a = book("A", ownership = BookOwnership.OWNED)
        val b = book("B", ownership = BookOwnership.OWNED)
        listOf(c, a, b).forEach { repo.insert(it) }
        repo.insert(book("Unrelated", ownership = BookOwnership.WATCHLIST))

        val page = repo.search(null, BookFilters(ownership = setOf(BookOwnership.OWNED)), PageRequest())

        assertEquals(listOf(a.id, b.id, c.id), page.items.map { it.id })
    }

    // sort

    @Test
    fun `RELEASE_ASC orders by year then dated books before year-only books in the same year then title then id`() =
        withFreshDatabase {
            val repo = ExposedBookRepository()
            val old = book("Old", releaseYear = 1999)
            // "Zulu" sorts after "Alpha" alphabetically, but the dated book must still come first within 2000.
            val datedInYear2000 = book("Zulu", releaseDate = ReleaseDate(LocalDate.of(2000, 6, 1)))
            val yearOnlyIn2000 = book("Alpha", releaseYear = 2000)
            val newer = book("New", releaseYear = 2010)
            listOf(newer, yearOnlyIn2000, old, datedInYear2000).forEach { repo.insert(it) }

            val page = repo.search(null, BookFilters.NONE, PageRequest(), BookSort.RELEASE_ASC)

            assertEquals(
                listOf(old.id, datedInYear2000.id, yearOnlyIn2000.id, newer.id),
                page.items.map { it.id },
            )
        }

    @Test
    fun `RELEASE_DESC orders by year then year-only books before dated books in the same year then title then id`() =
        withFreshDatabase {
            val repo = ExposedBookRepository()
            val old = book("Old", releaseYear = 1999)
            val datedInYear2000 = book("Zulu", releaseDate = ReleaseDate(LocalDate.of(2000, 6, 1)))
            val yearOnlyIn2000 = book("Alpha", releaseYear = 2000)
            val newer = book("New", releaseYear = 2010)
            listOf(newer, yearOnlyIn2000, old, datedInYear2000).forEach { repo.insert(it) }

            val page = repo.search(null, BookFilters.NONE, PageRequest(), BookSort.RELEASE_DESC)

            assertEquals(
                listOf(newer.id, yearOnlyIn2000.id, datedInYear2000.id, old.id),
                page.items.map { it.id },
            )
        }

    @Test
    fun `release sorts break a tie on year and release date by title then id in both directions`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val alphaFirst =
            book("Alpha", releaseYear = 2000, id = BookId.parse("00000000-0000-0000-0000-000000000001"))
        val alphaSecond =
            book("Alpha", releaseYear = 2000, id = BookId.parse("00000000-0000-0000-0000-000000000002"))
        val beta = book("Beta", releaseYear = 2000)
        listOf(beta, alphaSecond, alphaFirst).forEach { repo.insert(it) }

        val asc = repo.search(null, BookFilters.NONE, PageRequest(), BookSort.RELEASE_ASC)
        val desc = repo.search(null, BookFilters.NONE, PageRequest(), BookSort.RELEASE_DESC)

        assertEquals(listOf(alphaFirst.id, alphaSecond.id, beta.id), asc.items.map { it.id })
        assertEquals(listOf(alphaFirst.id, alphaSecond.id, beta.id), desc.items.map { it.id })
    }

    @Test
    fun `a non-default sort together with a search term overrides relevance ordering but keeps the match filter`() =
        withFreshDatabase {
            val repo = ExposedBookRepository()
            val duneOld = book("Dune One", releaseYear = 1965)
            val duneNew = book("Dune Two", releaseYear = 2021)
            val unrelatedNewest = book("Neuromancer", releaseYear = 2024)
            listOf(unrelatedNewest, duneOld, duneNew).forEach { repo.insert(it) }

            val page = repo.search(SearchTerm("dune"), BookFilters.NONE, PageRequest(), BookSort.RELEASE_DESC)

            assertEquals(listOf(duneNew.id, duneOld.id), page.items.map { it.id })
            assertEquals(2, page.totalItems)
        }

    @Test
    fun `a release sort combines with ownership and type filters`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val older = book(
            "Older",
            releaseYear = 1990,
            ownership = BookOwnership.OWNED,
            types = listOf(BookTypes.KINDLE),
        )
        val newer = book(
            "Newer",
            releaseYear = 2020,
            ownership = BookOwnership.OWNED,
            types = listOf(BookTypes.KINDLE),
        )
        repo.insert(newer)
        repo.insert(older)
        repo.insert(
            book(
                "Wrong ownership",
                releaseYear = 2000,
                ownership = BookOwnership.WATCHLIST,
                types = listOf(BookTypes.KINDLE),
            ),
        )
        repo.insert(
            book("Wrong type", releaseYear = 2001, ownership = BookOwnership.OWNED, types = listOf(BookTypes.AUDIBLE)),
        )

        val filters = BookFilters(typeIds = setOf(BookTypes.KINDLE.id), ownership = setOf(BookOwnership.OWNED))
        val asc = repo.search(null, filters, PageRequest(), BookSort.RELEASE_ASC)
        val desc = repo.search(null, filters, PageRequest(), BookSort.RELEASE_DESC)

        assertEquals(listOf(older.id, newer.id), asc.items.map { it.id })
        assertEquals(listOf(newer.id, older.id), desc.items.map { it.id })
        assertEquals(2, asc.totalItems)
    }

    @Test
    fun `missing description filter returns only the book without a description`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val noDescription = book("Alpha", description = null)
        repo.insert(noDescription)
        repo.insert(book("Beta", description = Description("a description")))

        val page = repo.search(null, BookFilters(missing = setOf(BookMissingField.DESCRIPTION)), PageRequest())

        assertEquals(listOf(noDescription.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `missing description or missing cover image matches either incomplete book`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val noDescription = book("Alpha", coverImageUrl = CoverImageUrl("https://example.com/alpha.jpg"))
        val noCover = book("Beta", description = Description("a description"))
        val complete = book(
            "Gamma",
            description = Description("a description"),
            coverImageUrl = CoverImageUrl("https://example.com/gamma.jpg"),
        )
        listOf(noDescription, noCover, complete).forEach { repo.insert(it) }

        val filters = BookFilters(missing = setOf(BookMissingField.DESCRIPTION, BookMissingField.COVER_IMAGE_URL))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(setOf(noDescription.id, noCover.id), page.items.map { it.id }.toSet())
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `missing description combined with ownership filter matches only books satisfying both`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        val matchesBoth = book("Alpha", ownership = BookOwnership.OWNED)
        val missingOnly = book("Beta", ownership = BookOwnership.WATCHLIST)
        val ownedOnly = book("Gamma", description = Description("a description"), ownership = BookOwnership.OWNED)
        listOf(matchesBoth, missingOnly, ownedOnly).forEach { repo.insert(it) }

        val filters = BookFilters(
            missing = setOf(BookMissingField.DESCRIPTION),
            ownership = setOf(BookOwnership.OWNED),
        )
        val page = repo.search(null, filters, PageRequest())

        assertEquals(listOf(matchesBoth.id), page.items.map { it.id })
    }

    @Test
    fun `findUsedFilterValues returns only the values in use`() = withFreshDatabase {
        val repo = ExposedBookRepository()
        repo.insert(
            book(
                "Alpha",
                types = listOf(BookTypes.HARDCOVER),
                releaseYear = 2010,
                ownership = BookOwnership.OWNED,
                progress = BookProgress.READING,
            ),
        )
        repo.insert(
            book(
                "Beta",
                types = listOf(BookTypes.KINDLE),
                releaseYear = 2015,
                ownership = BookOwnership.WATCHLIST,
                progress = BookProgress.FINISHED,
            ),
        )
        repo.insert(book("Untyped", releaseYear = 2015))

        val used = repo.findUsedFilterValues()

        assertEquals(setOf(BookTypes.HARDCOVER.id, BookTypes.KINDLE.id), used.typeIds)
        assertEquals(setOf(BookOwnership.OWNED, BookOwnership.WATCHLIST), used.ownership)
        assertEquals(setOf(BookProgress.READING, BookProgress.FINISHED, BookProgress.NOT_STARTED), used.progress)
        assertEquals(setOf(ReleaseYear(2010), ReleaseYear(2015)), used.releaseYears)
    }

    // findBySeries

    @Test
    fun `findBySeries orders by position with unnumbered books last by title`() = withFreshDatabase {
        val mistborn = ExposedBookSeriesRepository().create(VocabularyName("Mistborn")).entry
        val repo = ExposedBookRepository()
        val unnumberedB = book("B Novella", series = listOf(seriesEntry(mistborn)))
        val numbered25 = book("Z Interlude", series = listOf(seriesEntry(mistborn, 2.5)))
        val unnumberedA = book("A Companion", series = listOf(seriesEntry(mistborn)))
        val numbered1 = book("Y Second", series = listOf(seriesEntry(mistborn, 1.0)))
        val numbered0 = book("X Prequel", series = listOf(seriesEntry(mistborn, 0.0)))
        listOf(unnumberedB, numbered25, unnumberedA, numbered1, numbered0).forEach { repo.insert(it) }

        val found = repo.findBySeries(mistborn.id)

        assertEquals(
            listOf("X Prequel", "Y Second", "Z Interlude", "A Companion", "B Novella"),
            found.map { it.title.value },
        )
    }

    @Test
    fun `findBySeries returns only the books of that series and an empty list for an empty one`() = withFreshDatabase {
        val seriesRepo = ExposedBookSeriesRepository()
        val mistborn = seriesRepo.create(VocabularyName("Mistborn")).entry
        val dune = seriesRepo.create(VocabularyName("Dune")).entry
        val empty = seriesRepo.create(VocabularyName("Empty")).entry
        val repo = ExposedBookRepository()
        val inMistborn = book("The Final Empire", series = listOf(seriesEntry(mistborn, 1.0)))
        repo.insert(inMistborn)
        repo.insert(book("Dune", series = listOf(seriesEntry(dune, 1.0))))
        repo.insert(book("Standalone"))

        assertEquals(listOf(inMistborn.id), repo.findBySeries(mistborn.id).map { it.id })
        assertEquals(emptyList(), repo.findBySeries(empty.id))
    }

    @Test
    fun `findBySeries hydrates types authors narrators and all series of the book`() = withFreshDatabase {
        val herbert = ExposedBookAuthorRepository().create(VocabularyName("Frank Herbert")).entry
        val reader = ExposedBookNarratorRepository().create(VocabularyName("A Reader")).entry
        val seriesRepo = ExposedBookSeriesRepository()
        val mistborn = seriesRepo.create(VocabularyName("Mistborn")).entry
        val cosmere = seriesRepo.create(VocabularyName("The Cosmere")).entry
        val repo = ExposedBookRepository()
        val inserted = book(
            "The Final Empire",
            types = listOf(BookTypes.PAPERBACK, BookTypes.HARDCOVER),
            authors = listOf(herbert),
            narrators = listOf(reader),
            series = listOf(seriesEntry(mistborn, 1.0), seriesEntry(cosmere, 3.0)),
        )
        repo.insert(inserted)

        val found = repo.findBySeries(mistborn.id)

        assertEquals(listOf(inserted), found)
    }

    @Test
    fun `findBySeries loads a series with a constant number of queries`() = withFreshDatabase { db ->
        val herbert = ExposedBookAuthorRepository().create(VocabularyName("Frank Herbert")).entry
        val reader = ExposedBookNarratorRepository().create(VocabularyName("A Reader")).entry
        val dune = ExposedBookSeriesRepository().create(VocabularyName("Dune Chronicles")).entry
        val repo = ExposedBookRepository()
        val twoTypes = listOf(BookTypes.HARDCOVER, BookTypes.KINDLE)
        suspend fun insertBooks(range: IntRange) = range.forEach {
            repo.insert(
                book(
                    "Dune $it",
                    types = twoTypes,
                    authors = listOf(herbert),
                    narrators = listOf(reader),
                    series = listOf(seriesEntry(dune, it.toDouble())),
                ),
            )
        }
        insertBooks(1..2)

        val countWithTwoBooks = countStatements(db.database) { repo.findBySeries(dune.id) }

        insertBooks(3..5)
        val countWithFiveBooks = countStatements(db.database) { repo.findBySeries(dune.id) }

        assertEquals(5, countWithTwoBooks)
        assertEquals(countWithTwoBooks, countWithFiveBooks)
    }

    // findByAuthor

    @Test
    fun `findByAuthor orders by year then date with undated last then title and id`() = withFreshDatabase {
        val herbert = ExposedBookAuthorRepository().create(VocabularyName("Frank Herbert")).entry
        val repo = ExposedBookRepository()
        val books = listOf(
            book("Late 2001", releaseYear = 2001, authors = listOf(herbert)),
            book("Undated B", releaseYear = 2000, authors = listOf(herbert)),
            book("Undated A", releaseYear = 2000, authors = listOf(herbert)),
            book("Dated June", releaseDate = ReleaseDate(LocalDate.of(2000, 6, 1)), authors = listOf(herbert)),
            book("Dated Jan Z", releaseDate = ReleaseDate(LocalDate.of(2000, 1, 1)), authors = listOf(herbert)),
            book("Dated Jan A", releaseDate = ReleaseDate(LocalDate.of(2000, 1, 1)), authors = listOf(herbert)),
            book("Early 1999", releaseYear = 1999, authors = listOf(herbert)),
        )
        books.forEach { repo.insert(it) }

        val found = repo.findByAuthor(herbert.id)

        assertEquals(
            listOf("Early 1999", "Dated Jan A", "Dated Jan Z", "Dated June", "Undated A", "Undated B", "Late 2001"),
            found.map { it.title.value },
        )
    }

    @Test
    fun `findByAuthor returns only the books of that author and an empty list for one without books`() =
        withFreshDatabase {
            val authorRepo = ExposedBookAuthorRepository()
            val herbert = authorRepo.create(VocabularyName("Frank Herbert")).entry
            val adams = authorRepo.create(VocabularyName("Douglas Adams")).entry
            val empty = authorRepo.create(VocabularyName("Empty")).entry
            val repo = ExposedBookRepository()
            val dune = book("Dune", authors = listOf(herbert))
            repo.insert(dune)
            repo.insert(book("Guide", authors = listOf(adams)))
            repo.insert(book("Standalone"))

            assertEquals(listOf(dune.id), repo.findByAuthor(herbert.id).map { it.id })
            assertEquals(emptyList(), repo.findByAuthor(empty.id))
        }

    @Test
    fun `findByAuthor hydrates types all authors narrators and series of the book`() = withFreshDatabase {
        val authorRepo = ExposedBookAuthorRepository()
        val herbert = authorRepo.create(VocabularyName("Frank Herbert")).entry
        val coauthor = authorRepo.create(VocabularyName("Brian Herbert")).entry
        val reader = ExposedBookNarratorRepository().create(VocabularyName("A Reader")).entry
        val dune = ExposedBookSeriesRepository().create(VocabularyName("Dune Chronicles")).entry
        val repo = ExposedBookRepository()
        val inserted = book(
            "Dune",
            types = listOf(BookTypes.PAPERBACK, BookTypes.HARDCOVER),
            authors = listOf(herbert, coauthor),
            narrators = listOf(reader),
            series = listOf(seriesEntry(dune, 1.0)),
        )
        repo.insert(inserted)

        val found = repo.findByAuthor(herbert.id)

        assertEquals(listOf(inserted), found)
    }

    @Test
    fun `findByAuthor loads an author's books with a constant number of queries`() = withFreshDatabase { db ->
        val herbert = ExposedBookAuthorRepository().create(VocabularyName("Frank Herbert")).entry
        val reader = ExposedBookNarratorRepository().create(VocabularyName("A Reader")).entry
        val dune = ExposedBookSeriesRepository().create(VocabularyName("Dune Chronicles")).entry
        val repo = ExposedBookRepository()
        val twoTypes = listOf(BookTypes.HARDCOVER, BookTypes.KINDLE)
        suspend fun insertBooks(range: IntRange) = range.forEach {
            repo.insert(
                book(
                    "Dune $it",
                    types = twoTypes,
                    authors = listOf(herbert),
                    narrators = listOf(reader),
                    series = listOf(seriesEntry(dune, it.toDouble())),
                ),
            )
        }
        insertBooks(1..2)

        val countWithTwoBooks = countStatements(db.database) { repo.findByAuthor(herbert.id) }

        insertBooks(3..5)
        val countWithFiveBooks = countStatements(db.database) { repo.findByAuthor(herbert.id) }

        assertEquals(5, countWithTwoBooks)
        assertEquals(countWithTwoBooks, countWithFiveBooks)
    }
}
