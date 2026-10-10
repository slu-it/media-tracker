package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.book
import de.sluit.mediatracker.books.domain.BookNarratorId
import de.sluit.mediatracker.books.domain.BookNarratorSummary
import de.sluit.mediatracker.common.domain.DeleteOutcome
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
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Trimmed twin of [ExposedBookAuthorRepositoryTest]: the search and create logic is the shared
 * `ExposedNameVocabulary`, exercised in depth there; this only checks the binding to [BookNarratorsTable].
 */
class ExposedBookNarratorRepositoryTest {

    @Test
    fun `search with no term lists narrators alphabetically`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        repo.create(VocabularyName("Zed"))
        repo.create(VocabularyName("Able"))

        val result = repo.search(null, VocabularySearchLimit.DEFAULT)

        assertEquals(listOf("Able", "Zed"), result.map { it.name.value })
    }

    @Test
    fun `search matches a name prefix`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val mistborn = repo.create(VocabularyName("Mistborn")).entry
        repo.create(VocabularyName("The Cosmere"))

        val result = repo.search(SearchTerm("mist"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf(mistborn.id), result.map { it.id })
    }

    @Test
    fun `create is idempotent for a case-insensitive existing name`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val first = repo.create(VocabularyName("Mistborn"))
        assertTrue(first.created)

        val second = repo.create(VocabularyName("mistborn"))

        assertTrue(!second.created)
        assertEquals(first.entry.id, second.entry.id)
    }

    @Test
    fun `findByIds returns only the requested narrators`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val mistborn = repo.create(VocabularyName("Mistborn")).entry
        repo.create(VocabularyName("The Cosmere"))

        assertEquals(listOf(mistborn), repo.findByIds(setOf(mistborn.id)))
        assertEquals(emptyList(), repo.findByIds(emptySet()))
    }

    @Test
    fun `concurrent create for the same name never yields two ids or two rows`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val name = VocabularyName("Mistborn")

        val results = coroutineScope {
            (1..20).map { async { repo.create(name) } }.awaitAll()
        }

        assertEquals(1, results.map { it.entry.id }.toSet().size)
        val rowCount = transaction {
            BookNarratorsTable.selectAll().where { BookNarratorsTable.name eq name.value }.count()
        }
        assertEquals(1, rowCount)
    }

    @Test
    fun `findSummaries counts books per narrator including narrators without books`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val herbert = repo.create(VocabularyName("Frank Herbert")).entry
        val empty = repo.create(VocabularyName("Another Author")).entry
        val bookRepo = ExposedBookRepository()
        bookRepo.insert(book("Dune", narrators = listOf(herbert)))
        bookRepo.insert(book("Dune Messiah", narrators = listOf(herbert)))

        val result = repo.findSummaries()

        assertEquals(listOf(BookNarratorSummary(empty, 0), BookNarratorSummary(herbert, 2)), result)
    }

    @Test
    fun `findSummaries orders by name accent-insensitively`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        repo.create(VocabularyName("Zed"))
        repo.create(VocabularyName("Ärger"))
        repo.create(VocabularyName("Beta"))

        val result = repo.findSummaries()

        assertEquals(listOf("Ärger", "Beta", "Zed"), result.map { it.narrator.name.value })
    }

    @Test
    fun `findSummaries counts a book with two narrators for both`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val a = repo.create(VocabularyName("A Author")).entry
        val b = repo.create(VocabularyName("B Author")).entry
        ExposedBookRepository().insert(book("Shared", narrators = listOf(a, b)))

        val result = repo.findSummaries()

        assertEquals(listOf(1, 1), result.map { it.bookCount })
    }

    @Test
    fun `findSummaries is empty without narrators`() = withFreshDatabase {
        assertEquals(emptyList(), ExposedBookNarratorRepository().findSummaries())
    }

    @Test
    fun `delete removes an unreferenced narrator`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val narrator = repo.create(VocabularyName("Frank Herbert")).entry

        assertEquals(DeleteOutcome.DELETED, repo.delete(narrator.id))

        assertEquals(emptyList(), repo.findByIds(setOf(narrator.id)))
    }

    @Test
    fun `delete of an unknown narrator is not found`() = withFreshDatabase {
        assertEquals(DeleteOutcome.NOT_FOUND, ExposedBookNarratorRepository().delete(BookNarratorId.new()))
    }

    @Test
    fun `delete keeps a narrator that a book references`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val narrator = repo.create(VocabularyName("Frank Herbert")).entry
        ExposedBookRepository().insert(book("Dune", narrators = listOf(narrator)))

        assertEquals(DeleteOutcome.IN_USE, repo.delete(narrator.id))

        assertEquals(listOf(narrator), repo.findByIds(setOf(narrator.id)))
    }

    @Test
    fun `rename changes the name`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val narrator = repo.create(VocabularyName("Frank Herbet")).entry

        val outcome = repo.rename(narrator.id, VocabularyName("Frank Herbert"))

        assertEquals(RenameOutcome.Renamed(narrator.copy(name = VocabularyName("Frank Herbert"))), outcome)
        assertEquals("Frank Herbert", repo.findByIds(setOf(narrator.id)).single().name.value)
    }

    @Test
    fun `rename of an unknown narrator is not found`() = withFreshDatabase {
        val outcome = ExposedBookNarratorRepository().rename(BookNarratorId.new(), VocabularyName("Frank Herbert"))

        assertEquals(RenameOutcome.NotFound, outcome)
    }

    @Test
    fun `rename onto another narrator's name is taken and changes nothing`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val herbert = repo.create(VocabularyName("Frank Herbert")).entry
        val other = repo.create(VocabularyName("Douglas Adams")).entry

        val outcome = repo.rename(other.id, VocabularyName("frank herbert"))

        assertEquals(RenameOutcome.Taken(herbert), outcome)
        assertEquals("Douglas Adams", repo.findByIds(setOf(other.id)).single().name.value)
    }

    @Test
    fun `rename to a differently cased spelling of its own name is a plain rename`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val narrator = repo.create(VocabularyName("frank herbert")).entry

        val outcome = repo.rename(narrator.id, VocabularyName("Frank Herbert"))

        assertIs<RenameOutcome.Renamed<*>>(outcome)
        assertEquals("Frank Herbert", repo.findByIds(setOf(narrator.id)).single().name.value)
    }

    @Test
    fun `rename reports taken when a competing insert of the name commits mid-transaction`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val narrator = repo.create(VocabularyName("Frank Herbet")).entry
        val name = VocabularyName("Frank Herbert")
        var winnerId: BookNarratorId? = null

        val outcome = repo.rename(narrator.id, name) {
            val thread = Thread {
                transaction {
                    val id = BookNarratorId.new()
                    winnerId = id
                    BookNarratorsTable.insert {
                        it[BookNarratorsTable.id] = id.toString()
                        it[BookNarratorsTable.name] = name.value
                    }
                }
            }
            thread.start()
            thread.join()
        }

        assertEquals(RenameOutcome.Taken(narrator.copy(id = winnerId!!, name = name)), outcome)
        assertEquals("Frank Herbet", repo.findByIds(setOf(narrator.id)).single().name.value)
    }

    @Test
    fun `merge moves the books of the source to the target and deletes the source`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val source = repo.create(VocabularyName("F. Herbert")).entry
        val target = repo.create(VocabularyName("Frank Herbert")).entry
        val books = ExposedBookRepository()
        val dune = book("Dune", narrators = listOf(source))
        books.insert(dune)

        val outcome = repo.merge(source.id, target.id)

        assertEquals(MergeOutcome.Merged(target), outcome)
        assertEquals(emptyList(), repo.findByIds(setOf(source.id)))
        assertEquals(listOf(target), books.findById(dune.id)!!.narrators)
        assertEquals(listOf(BookNarratorSummary(target, 1)), repo.findSummaries())
    }

    @Test
    fun `merge links a book of both narrators only once`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val source = repo.create(VocabularyName("F. Herbert")).entry
        val target = repo.create(VocabularyName("Frank Herbert")).entry
        val books = ExposedBookRepository()
        val shared = book("Shared", narrators = listOf(source, target))
        val onlySource = book("Only source", narrators = listOf(source))
        val onlyTarget = book("Only target", narrators = listOf(target))
        listOf(shared, onlySource, onlyTarget).forEach { books.insert(it) }

        repo.merge(source.id, target.id)

        assertEquals(listOf(target), books.findById(shared.id)!!.narrators)
        assertEquals(listOf(BookNarratorSummary(target, 3)), repo.findSummaries())
    }

    @Test
    fun `merge with an unknown source or target is not found and changes nothing`() = withFreshDatabase {
        val repo = ExposedBookNarratorRepository()
        val known = repo.create(VocabularyName("Frank Herbert")).entry

        assertEquals(MergeOutcome.SourceNotFound, repo.merge(BookNarratorId.new(), known.id))
        assertEquals(MergeOutcome.TargetNotFound, repo.merge(known.id, BookNarratorId.new()))
        assertEquals(listOf(known), repo.findByIds(setOf(known.id)))
    }
}
