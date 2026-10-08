package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Trimmed twin of [ExposedBookAuthorRepositoryTest]: the search and create logic is the shared
 * `ExposedNameVocabulary`, exercised in depth there; this only checks the binding to [BookSeriesTable].
 */
class ExposedBookSeriesRepositoryTest {

    @Test
    fun `search with no term lists series alphabetically`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        repo.create(VocabularyName("Zed"))
        repo.create(VocabularyName("Able"))

        val result = repo.search(null, VocabularySearchLimit.DEFAULT)

        assertEquals(listOf("Able", "Zed"), result.map { it.name.value })
    }

    @Test
    fun `search matches a name prefix`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val mistborn = repo.create(VocabularyName("Mistborn")).entry
        repo.create(VocabularyName("The Cosmere"))

        val result = repo.search(SearchTerm("mist"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf(mistborn.id), result.map { it.id })
    }

    @Test
    fun `create is idempotent for a case-insensitive existing name`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val first = repo.create(VocabularyName("Mistborn"))
        assertTrue(first.created)

        val second = repo.create(VocabularyName("mistborn"))

        assertTrue(!second.created)
        assertEquals(first.entry.id, second.entry.id)
    }

    @Test
    fun `findByIds returns only the requested series`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val mistborn = repo.create(VocabularyName("Mistborn")).entry
        repo.create(VocabularyName("The Cosmere"))

        assertEquals(listOf(mistborn), repo.findByIds(setOf(mistborn.id)))
        assertEquals(emptyList(), repo.findByIds(emptySet()))
    }

    @Test
    fun `concurrent create for the same name never yields two ids or two rows`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val name = VocabularyName("Mistborn")

        val results = coroutineScope {
            (1..20).map { async { repo.create(name) } }.awaitAll()
        }

        assertEquals(1, results.map { it.entry.id }.toSet().size)
        val rowCount = transaction {
            BookSeriesTable.selectAll().where { BookSeriesTable.name eq name.value }.count()
        }
        assertEquals(1, rowCount)
    }
}
