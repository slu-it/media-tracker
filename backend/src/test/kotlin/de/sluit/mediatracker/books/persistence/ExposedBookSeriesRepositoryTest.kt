package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.book
import de.sluit.mediatracker.books.domain.BookSeriesId
import de.sluit.mediatracker.books.domain.BookSeriesSummary
import de.sluit.mediatracker.books.domain.DeleteOutcome
import de.sluit.mediatracker.books.seriesEntry
import de.sluit.mediatracker.common.domain.MergeOutcome
import de.sluit.mediatracker.common.domain.RenameOutcome
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

    @Test
    fun `findSummaries counts books per series including empty ones`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val bookRepo = ExposedBookRepository()
        val mistborn = repo.create(VocabularyName("Mistborn")).entry
        val empty = repo.create(VocabularyName("Empty")).entry
        bookRepo.insert(book("One", series = listOf(seriesEntry(mistborn, 1.0))))
        bookRepo.insert(book("Two", series = listOf(seriesEntry(mistborn))))

        val result = repo.findSummaries()

        assertEquals(
            listOf(BookSeriesSummary(empty, 0), BookSeriesSummary(mistborn, 2)),
            result,
        )
    }

    @Test
    fun `findSummaries orders by name accent-insensitively`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        repo.create(VocabularyName("Zed"))
        repo.create(VocabularyName("Ärger"))
        repo.create(VocabularyName("Beta"))

        val result = repo.findSummaries()

        assertEquals(listOf("Ärger", "Beta", "Zed"), result.map { it.series.name.value })
    }

    @Test
    fun `findSummaries counts a book in two series in both`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val a = repo.create(VocabularyName("A Series")).entry
        val b = repo.create(VocabularyName("B Series")).entry
        ExposedBookRepository().insert(book("Shared", series = listOf(seriesEntry(a, 1.0), seriesEntry(b))))

        val result = repo.findSummaries()

        assertEquals(listOf(1, 1), result.map { it.bookCount })
    }

    @Test
    fun `findSummaries is empty without series`() = withFreshDatabase {
        assertEquals(emptyList(), ExposedBookSeriesRepository().findSummaries())
    }

    @Test
    fun `delete removes an unreferenced series`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val series = repo.create(VocabularyName("Mistborn")).entry

        assertEquals(DeleteOutcome.DELETED, repo.delete(series.id))

        assertEquals(emptyList(), repo.findByIds(setOf(series.id)))
    }

    @Test
    fun `delete of an unknown series is not found`() = withFreshDatabase {
        assertEquals(DeleteOutcome.NOT_FOUND, ExposedBookSeriesRepository().delete(BookSeriesId.new()))
    }

    @Test
    fun `delete keeps a series that a book references`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val series = repo.create(VocabularyName("Mistborn")).entry
        ExposedBookRepository().insert(book("One", series = listOf(seriesEntry(series, 1.0))))

        assertEquals(DeleteOutcome.IN_USE, repo.delete(series.id))

        assertEquals(listOf(series), repo.findByIds(setOf(series.id)))
    }

    @Test
    fun `rename changes the name`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val series = repo.create(VocabularyName("Mistbron")).entry

        val outcome = repo.rename(series.id, VocabularyName("Mistborn"))

        assertEquals(RenameOutcome.Renamed(series.copy(name = VocabularyName("Mistborn"))), outcome)
        assertEquals("Mistborn", repo.findByIds(setOf(series.id)).single().name.value)
    }

    @Test
    fun `rename of an unknown series is not found`() = withFreshDatabase {
        val outcome = ExposedBookSeriesRepository().rename(BookSeriesId.new(), VocabularyName("Mistborn"))

        assertEquals(RenameOutcome.NotFound, outcome)
    }

    @Test
    fun `rename onto another series' name is taken`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val mistborn = repo.create(VocabularyName("Mistborn")).entry
        val other = repo.create(VocabularyName("Stormlight")).entry

        val outcome = repo.rename(other.id, VocabularyName("MISTBORN"))

        assertEquals(RenameOutcome.Taken(mistborn), outcome)
        assertEquals("Stormlight", repo.findByIds(setOf(other.id)).single().name.value)
    }

    @Test
    fun `rename to a differently cased spelling of its own name is a plain rename`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val series = repo.create(VocabularyName("mistborn")).entry

        repo.rename(series.id, VocabularyName("Mistborn"))

        assertEquals("Mistborn", repo.findByIds(setOf(series.id)).single().name.value)
    }

    @Test
    fun `merge moves the books with their positions and deletes the source`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val source = repo.create(VocabularyName("Mistborn Era 1")).entry
        val target = repo.create(VocabularyName("Mistborn")).entry
        val books = ExposedBookRepository()
        val first = book("The Final Empire", series = listOf(seriesEntry(source, 1.0)))
        val unnumbered = book("Secret History", series = listOf(seriesEntry(source)))
        listOf(first, unnumbered).forEach { books.insert(it) }

        val outcome = repo.merge(source.id, target.id)

        assertEquals(MergeOutcome.Merged(target), outcome)
        assertEquals(emptyList(), repo.findByIds(setOf(source.id)))
        assertEquals(
            listOf(target to 1.0),
            books.findById(first.id)!!.series.map { it.series to it.position?.value?.toDouble() },
        )
        assertEquals(
            listOf(target to null),
            books.findById(unnumbered.id)!!.series.map { it.series to it.position?.value?.toDouble() },
        )
        assertEquals(listOf(BookSeriesSummary(target, 2)), repo.findSummaries())
    }

    @Test
    fun `merge of a book in both series keeps the target's position`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val source = repo.create(VocabularyName("Old Mistborn")).entry
        val target = repo.create(VocabularyName("Mistborn")).entry
        val books = ExposedBookRepository()
        val shared = book("Shared", series = listOf(seriesEntry(source, 2.0), seriesEntry(target, 5.0)))
        books.insert(shared)

        repo.merge(source.id, target.id)

        assertEquals(
            listOf(target to 5.0),
            books.findById(shared.id)!!.series.map { it.series to it.position?.value?.toDouble() },
        )
    }

    @Test
    fun `merge of a book in both series takes the source's position when the target has none`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val source = repo.create(VocabularyName("Old Mistborn")).entry
        val target = repo.create(VocabularyName("Mistborn")).entry
        val books = ExposedBookRepository()
        val shared = book("Shared", series = listOf(seriesEntry(source, 2.0), seriesEntry(target)))
        books.insert(shared)

        repo.merge(source.id, target.id)

        assertEquals(
            listOf(target to 2.0),
            books.findById(shared.id)!!.series.map { it.series to it.position?.value?.toDouble() },
        )
    }

    @Test
    fun `merge with an unknown source or target is not found and changes nothing`() = withFreshDatabase {
        val repo = ExposedBookSeriesRepository()
        val known = repo.create(VocabularyName("Mistborn")).entry

        assertEquals(MergeOutcome.SourceNotFound, repo.merge(BookSeriesId.new(), known.id))
        assertEquals(MergeOutcome.TargetNotFound, repo.merge(known.id, BookSeriesId.new()))
        assertEquals(listOf(known), repo.findByIds(setOf(known.id)))
    }
}
