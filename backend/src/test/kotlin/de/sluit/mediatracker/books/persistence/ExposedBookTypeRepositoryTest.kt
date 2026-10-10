package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.BookTypes
import de.sluit.mediatracker.books.SeededBookTypes
import de.sluit.mediatracker.books.book
import de.sluit.mediatracker.books.domain.BookType
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.books.domain.BookTypeLabel
import de.sluit.mediatracker.common.domain.CreateOutcome
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.RenameOutcome
import de.sluit.mediatracker.common.persistence.countStatements
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlin.uuid.Uuid

class ExposedBookTypeRepositoryTest {

    @Test
    fun `findAll returns the four seeded types sorted by label`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()

        val all = repo.findAll()

        assertEquals(listOf("Audible", "Hardcover", "Kindle", "Paperback"), all.map { it.label.value })
        assertEquals(
            setOf(
                SeededBookTypes.HARDCOVER,
                SeededBookTypes.PAPERBACK,
                SeededBookTypes.KINDLE,
                SeededBookTypes.AUDIBLE,
            ),
            all.map { it.id.toString() }.toSet(),
        )
        assertEquals("5D4037", all.single { it.label.value == "Hardcover" }.color.value)
    }

    @Test
    fun `findByIds returns only the requested types`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()

        val result = repo.findByIds(setOf(BookTypes.HARDCOVER.id, BookTypes.KINDLE.id))

        assertEquals(setOf(BookTypes.HARDCOVER, BookTypes.KINDLE), result.toSet())
    }

    @Test
    fun `findByIds ignores unknown ids`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()

        val result = repo.findByIds(setOf(BookTypes.PAPERBACK.id, BookTypeId(Uuid.random())))

        assertEquals(listOf(BookTypes.PAPERBACK), result)
    }

    @Test
    fun `findByIds with an empty set returns an empty list without a query`() = withFreshDatabase { db ->
        val repo = ExposedBookTypeRepository()

        val count = countStatements(db.database) { assertTrue(repo.findByIds(emptySet()).isEmpty()) }

        assertEquals(0, count)
    }

    @Test
    fun `findSummaries lists every type with its book count ordered by label`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()
        ExposedBookRepository().insert(book("Dune", types = listOf(BookTypes.HARDCOVER, BookTypes.KINDLE)))
        ExposedBookRepository().insert(book("Emma", types = listOf(BookTypes.KINDLE)))

        val summaries = repo.findSummaries()

        assertEquals(
            listOf("Audible" to 0, "Hardcover" to 1, "Kindle" to 2, "Paperback" to 0),
            summaries.map { it.type.label.value to it.bookCount },
        )
    }

    @Test
    fun `findSummaries is a single query`() = withFreshDatabase { db ->
        val repo = ExposedBookTypeRepository()

        val count = countStatements(db.database) { repo.findSummaries() }

        assertEquals(1, count)
    }

    @Test
    fun `create inserts a type`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()

        val outcome = repo.create(BookTypeLabel("Comic"), HexColor("FF00FF"))

        val created = assertIs<CreateOutcome.Created<BookType>>(outcome).entry
        assertEquals(BookTypeLabel("Comic"), created.label)
        assertEquals(HexColor("FF00FF"), created.color)
        assertEquals(created, repo.findByIds(setOf(created.id)).single())
    }

    @Test
    fun `create with a taken label is taken whatever the case or accents`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()
        val cafe = (repo.create(BookTypeLabel("Café"), HexColor("111111")) as CreateOutcome.Created).entry

        assertEquals(CreateOutcome.Taken(BookTypes.KINDLE), repo.create(BookTypeLabel("kindle"), HexColor("000000")))
        assertEquals(CreateOutcome.Taken(cafe), repo.create(BookTypeLabel("CAFE"), HexColor("000000")))
        assertEquals(5, repo.findAll().size)
    }

    @Test
    fun `create reports taken when a competing insert of the label commits mid-transaction`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()
        var winnerId: String? = null

        val outcome = repo.create(BookTypeLabel("Comic"), HexColor("FF00FF")) {
            val thread = Thread {
                transaction {
                    winnerId = Uuid.random().toString()
                    BookTypesTable.insert {
                        it[id] = winnerId
                        it[label] = "Comic"
                        it[associatedColor] = "00FF00"
                    }
                }
            }
            thread.start()
            thread.join()
        }

        val existing = assertIs<CreateOutcome.Taken<BookType>>(outcome).existing
        assertEquals(winnerId, existing.id.toString())
        assertEquals(HexColor("00FF00"), existing.color)
    }

    @Test
    fun `update changes the label only`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()

        val outcome = repo.update(BookTypes.KINDLE.id, BookTypeLabel("E-Book"), null)

        assertEquals(RenameOutcome.Renamed(BookTypes.KINDLE.copy(label = BookTypeLabel("E-Book"))), outcome)
        assertEquals(BookTypes.KINDLE.color, repo.findByIds(setOf(BookTypes.KINDLE.id)).single().color)
    }

    @Test
    fun `update changes the colour only`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()

        val outcome = repo.update(BookTypes.KINDLE.id, null, HexColor("ABCDEF"))

        assertEquals(RenameOutcome.Renamed(BookTypes.KINDLE.copy(color = HexColor("ABCDEF"))), outcome)
        assertEquals(
            BookTypes.KINDLE.copy(color = HexColor("ABCDEF")),
            repo.findByIds(setOf(BookTypes.KINDLE.id)).single(),
        )
    }

    @Test
    fun `update to a differently cased spelling of its own label is a plain update`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()

        val outcome = repo.update(BookTypes.KINDLE.id, BookTypeLabel("KINDLE"), null)

        assertIs<RenameOutcome.Renamed<BookType>>(outcome)
        assertEquals("KINDLE", repo.findByIds(setOf(BookTypes.KINDLE.id)).single().label.value)
    }

    @Test
    fun `update onto another type's label is taken and changes nothing`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()

        val outcome = repo.update(BookTypes.KINDLE.id, BookTypeLabel("paperback"), HexColor("ABCDEF"))

        assertEquals(RenameOutcome.Taken(BookTypes.PAPERBACK), outcome)
        assertEquals(BookTypes.KINDLE, repo.findByIds(setOf(BookTypes.KINDLE.id)).single())
    }

    @Test
    fun `update of an unknown type is not found`() = withFreshDatabase {
        val outcome = ExposedBookTypeRepository().update(BookTypeId(Uuid.random()), BookTypeLabel("X"), null)

        assertEquals(RenameOutcome.NotFound, outcome)
    }

    @Test
    fun `update reports taken when a competing insert of the label commits mid-transaction`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()
        var winnerId: String? = null

        val outcome = repo.update(BookTypes.KINDLE.id, BookTypeLabel("Comic"), null) {
            val thread = Thread {
                transaction {
                    winnerId = Uuid.random().toString()
                    BookTypesTable.insert {
                        it[id] = winnerId
                        it[label] = "Comic"
                        it[associatedColor] = "00FF00"
                    }
                }
            }
            thread.start()
            thread.join()
        }

        assertEquals(winnerId, assertIs<RenameOutcome.Taken<BookType>>(outcome).existing.id.toString())
        assertEquals(BookTypes.KINDLE, repo.findByIds(setOf(BookTypes.KINDLE.id)).single())
    }

    @Test
    fun `delete removes an unused type`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()

        assertEquals(DeleteOutcome.DELETED, repo.delete(BookTypes.AUDIBLE.id))

        assertEquals(emptyList(), repo.findByIds(setOf(BookTypes.AUDIBLE.id)))
    }

    @Test
    fun `delete keeps a type that a book uses`() = withFreshDatabase {
        val repo = ExposedBookTypeRepository()
        ExposedBookRepository().insert(book("Dune", types = listOf(BookTypes.HARDCOVER)))

        assertEquals(DeleteOutcome.IN_USE, repo.delete(BookTypes.HARDCOVER.id))

        assertEquals(listOf(BookTypes.HARDCOVER), repo.findByIds(setOf(BookTypes.HARDCOVER.id)))
    }

    @Test
    fun `delete of an unknown type is not found`() = withFreshDatabase {
        assertEquals(DeleteOutcome.NOT_FOUND, ExposedBookTypeRepository().delete(BookTypeId(Uuid.random())))
    }
}
