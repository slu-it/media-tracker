package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.BookTypes
import de.sluit.mediatracker.books.SeededBookTypes
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.common.persistence.countStatements
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import kotlin.test.Test
import kotlin.test.assertEquals
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
}
