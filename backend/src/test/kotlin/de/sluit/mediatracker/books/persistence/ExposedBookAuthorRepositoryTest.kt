package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.book
import de.sluit.mediatracker.books.domain.BookAuthorId
import de.sluit.mediatracker.books.domain.BookAuthorSummary
import de.sluit.mediatracker.books.domain.DeleteOutcome
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

class ExposedBookAuthorRepositoryTest {

    @Test
    fun `search with no term lists authors alphabetically`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        repo.create(VocabularyName("Douglas Adams"))
        repo.create(VocabularyName("Frank Herbert"))

        val result = repo.search(null, VocabularySearchLimit.DEFAULT)

        assertEquals(listOf("Douglas Adams", "Frank Herbert"), result.map { it.name.value })
    }

    @Test
    fun `search matches a name prefix`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val herbert = repo.create(VocabularyName("Frank Herbert")).entry
        repo.create(VocabularyName("Douglas Adams"))

        val result = repo.search(SearchTerm("fra"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf(herbert.id), result.map { it.id })
    }

    @Test
    fun `search finds a two-letter name by its one-character prefix`() = withFreshDatabase {
        // InnoDB never indexes a word shorter than innodb_ft_min_token_size (3), so a name as short as "JK" has
        // no fulltext entry at all; only the LIKE-prefix fallback can find it.
        val repo = ExposedBookAuthorRepository()
        val jk = repo.create(VocabularyName("JK")).entry
        repo.create(VocabularyName("Douglas Adams"))

        val result = repo.search(SearchTerm("j"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf(jk.id), result.map { it.id })
    }

    @Test
    fun `search finds a two-letter name by its full two-character prefix`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val jk = repo.create(VocabularyName("JK")).entry
        repo.create(VocabularyName("Douglas Adams"))

        val result = repo.search(SearchTerm("jk"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf(jk.id), result.map { it.id })
    }

    @Test
    fun `search with only operator characters lists authors alphabetically`() = withFreshDatabase {
        // FulltextQuery.booleanMode strips every operator character; nothing searchable is left, so this falls
        // back to the same alphabetical listing as no term at all - consistent with ExposedBookRepository.search.
        val repo = ExposedBookAuthorRepository()
        repo.create(VocabularyName("Frank Herbert"))
        repo.create(VocabularyName("Douglas Adams"))

        val result = repo.search(SearchTerm("+-*"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf("Douglas Adams", "Frank Herbert"), result.map { it.name.value })
    }

    @Test
    fun `search ranks a LIKE-prefix hit above a fulltext-only match for a multi-word query`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        // "JK" is too short to be indexed, so only the literal "jk rowling" LIKE prefix finds this one that way;
        // it also happens to match the fulltext query through its "Rowling" word.
        val jkRowling = repo.create(VocabularyName("JK Rowling")).entry
        // Matches only through the fulltext "rowling*" term, never the literal "jk rowling" prefix.
        val maryRowling = repo.create(VocabularyName("Mary Rowling")).entry

        val result = repo.search(SearchTerm("jk rowling"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf(jkRowling.id, maryRowling.id), result.map { it.id })
    }

    @Test
    fun `search caps the result at the given limit`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        (1..3).forEach { repo.create(VocabularyName("Author $it")) }

        val result = repo.search(null, VocabularySearchLimit(2))

        assertEquals(2, result.size)
    }

    @Test
    fun `create is idempotent for a case-insensitive existing name`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val first = repo.create(VocabularyName("Frank Herbert"))
        assertTrue(first.created)

        val second = repo.create(VocabularyName("frank herbert"))

        assertTrue(!second.created)
        assertEquals(first.entry.id, second.entry.id)
    }

    /**
     * Deterministic counterpart to the fully concurrent test below: [ExposedBookAuthorRepository.create]'s
     * internal test seam commits a competing insert of the same name, on its own connection, in the exact window
     * between the initial lookup and this call's own insert - the same window the duplicate-key fallback exists
     * for - so this always exercises the fallback read itself rather than relying on Exposed's transaction retry
     * to eventually paper over a deadlock.
     */
    @Test
    fun `create falls back to the locking read when a competing insert commits mid-transaction`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val name = VocabularyName("Frank Herbert")
        var winnerId: BookAuthorId? = null

        val result = repo.create(name) {
            val thread = Thread {
                transaction {
                    val id = BookAuthorId.new()
                    winnerId = id
                    BookAuthorsTable.insert {
                        it[BookAuthorsTable.id] = id.toString()
                        it[BookAuthorsTable.name] = name.value
                    }
                }
            }
            thread.start()
            thread.join()
        }

        assertTrue(!result.created)
        assertEquals(winnerId, result.entry.id)
        val rowCount = transaction {
            BookAuthorsTable.selectAll().where { BookAuthorsTable.name eq name.value }.count()
        }
        assertEquals(1, rowCount)
    }

    @Test
    fun `search escapes a literal underscore so it does not act as a single-character wildcard`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val underscoreName = repo.create(VocabularyName("X_")).entry
        // Both names are too short for fulltext to index at all (below innodb_ft_min_token_size), so only the
        // LIKE-prefix fallback can find either of them, isolating the escaping behaviour under test.
        repo.create(VocabularyName("XY"))

        val result = repo.search(SearchTerm("x_"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf(underscoreName.id), result.map { it.id })
    }

    @Test
    fun `findByIds returns only the requested authors`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val herbert = repo.create(VocabularyName("Frank Herbert")).entry
        repo.create(VocabularyName("Douglas Adams"))

        val result = repo.findByIds(setOf(herbert.id))

        assertEquals(listOf(herbert), result)
    }

    @Test
    fun `findByIds with an empty set returns an empty list`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()

        assertEquals(emptyList(), repo.findByIds(emptySet()))
    }

    /**
     * Non-deterministic by nature (which coroutine wins the unique-index race depends on scheduling and the
     * shared pool's connection timing), so many parallel attempts rather than exactly two: with only a
     * two-connection test pool ([de.sluit.mediatracker.common.persistence.testDatabaseConfig]), some pair of
     * these is virtually certain to overlap and exercise the race in [ExposedBookAuthorRepository.create]'s
     * duplicate-key fallback . Every attempt must still agree on one id and the table must hold exactly
     * one row for the name, whichever one happened to win.
     */
    @Test
    fun `concurrent create for the same name never yields two ids or two rows`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val name = VocabularyName("Frank Herbert")

        val results = coroutineScope {
            (1..20).map { async { repo.create(name) } }.awaitAll()
        }

        assertEquals(1, results.map { it.entry.id }.toSet().size)
        val rowCount = transaction {
            BookAuthorsTable.selectAll().where { BookAuthorsTable.name eq name.value }.count()
        }
        assertEquals(1, rowCount)
    }

    @Test
    fun `findSummaries counts books per author including authors without books`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val herbert = repo.create(VocabularyName("Frank Herbert")).entry
        val empty = repo.create(VocabularyName("Another Author")).entry
        val bookRepo = ExposedBookRepository()
        bookRepo.insert(book("Dune", authors = listOf(herbert)))
        bookRepo.insert(book("Dune Messiah", authors = listOf(herbert)))

        val result = repo.findSummaries()

        assertEquals(listOf(BookAuthorSummary(empty, 0), BookAuthorSummary(herbert, 2)), result)
    }

    @Test
    fun `findSummaries orders by name accent-insensitively`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        repo.create(VocabularyName("Zed"))
        repo.create(VocabularyName("Ärger"))
        repo.create(VocabularyName("Beta"))

        val result = repo.findSummaries()

        assertEquals(listOf("Ärger", "Beta", "Zed"), result.map { it.author.name.value })
    }

    @Test
    fun `findSummaries counts a book with two authors for both`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val a = repo.create(VocabularyName("A Author")).entry
        val b = repo.create(VocabularyName("B Author")).entry
        ExposedBookRepository().insert(book("Shared", authors = listOf(a, b)))

        val result = repo.findSummaries()

        assertEquals(listOf(1, 1), result.map { it.bookCount })
    }

    @Test
    fun `findSummaries is empty without authors`() = withFreshDatabase {
        assertEquals(emptyList(), ExposedBookAuthorRepository().findSummaries())
    }

    @Test
    fun `delete removes an unreferenced author`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val author = repo.create(VocabularyName("Frank Herbert")).entry

        assertEquals(DeleteOutcome.DELETED, repo.delete(author.id))

        assertEquals(emptyList(), repo.findByIds(setOf(author.id)))
    }

    @Test
    fun `delete of an unknown author is not found`() = withFreshDatabase {
        assertEquals(DeleteOutcome.NOT_FOUND, ExposedBookAuthorRepository().delete(BookAuthorId.new()))
    }

    @Test
    fun `delete keeps an author that a book references`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val author = repo.create(VocabularyName("Frank Herbert")).entry
        ExposedBookRepository().insert(book("Dune", authors = listOf(author)))

        assertEquals(DeleteOutcome.IN_USE, repo.delete(author.id))

        assertEquals(listOf(author), repo.findByIds(setOf(author.id)))
    }

    @Test
    fun `rename changes the name`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val author = repo.create(VocabularyName("Frank Herbet")).entry

        val outcome = repo.rename(author.id, VocabularyName("Frank Herbert"))

        assertEquals(RenameOutcome.Renamed(author.copy(name = VocabularyName("Frank Herbert"))), outcome)
        assertEquals("Frank Herbert", repo.findByIds(setOf(author.id)).single().name.value)
    }

    @Test
    fun `rename of an unknown author is not found`() = withFreshDatabase {
        val outcome = ExposedBookAuthorRepository().rename(BookAuthorId.new(), VocabularyName("Frank Herbert"))

        assertEquals(RenameOutcome.NotFound, outcome)
    }

    @Test
    fun `rename onto another author's name is taken and changes nothing`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val herbert = repo.create(VocabularyName("Frank Herbert")).entry
        val other = repo.create(VocabularyName("Douglas Adams")).entry

        val outcome = repo.rename(other.id, VocabularyName("frank herbert"))

        assertEquals(RenameOutcome.Taken(herbert), outcome)
        assertEquals("Douglas Adams", repo.findByIds(setOf(other.id)).single().name.value)
    }

    @Test
    fun `rename to a differently cased spelling of its own name is a plain rename`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val author = repo.create(VocabularyName("frank herbert")).entry

        val outcome = repo.rename(author.id, VocabularyName("Frank Herbert"))

        assertIs<RenameOutcome.Renamed<*>>(outcome)
        assertEquals("Frank Herbert", repo.findByIds(setOf(author.id)).single().name.value)
    }

    @Test
    fun `rename reports taken when a competing insert of the name commits mid-transaction`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val author = repo.create(VocabularyName("Frank Herbet")).entry
        val name = VocabularyName("Frank Herbert")
        var winnerId: BookAuthorId? = null

        val outcome = repo.rename(author.id, name) {
            val thread = Thread {
                transaction {
                    val id = BookAuthorId.new()
                    winnerId = id
                    BookAuthorsTable.insert {
                        it[BookAuthorsTable.id] = id.toString()
                        it[BookAuthorsTable.name] = name.value
                    }
                }
            }
            thread.start()
            thread.join()
        }

        assertEquals(RenameOutcome.Taken(author.copy(id = winnerId!!, name = name)), outcome)
        assertEquals("Frank Herbet", repo.findByIds(setOf(author.id)).single().name.value)
    }

    @Test
    fun `merge moves the books of the source to the target and deletes the source`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val source = repo.create(VocabularyName("F. Herbert")).entry
        val target = repo.create(VocabularyName("Frank Herbert")).entry
        val books = ExposedBookRepository()
        val dune = book("Dune", authors = listOf(source))
        books.insert(dune)

        val outcome = repo.merge(source.id, target.id)

        assertEquals(MergeOutcome.Merged(target), outcome)
        assertEquals(emptyList(), repo.findByIds(setOf(source.id)))
        assertEquals(listOf(target), books.findById(dune.id)!!.authors)
        assertEquals(listOf(BookAuthorSummary(target, 1)), repo.findSummaries())
    }

    @Test
    fun `merge links a book of both authors only once`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val source = repo.create(VocabularyName("F. Herbert")).entry
        val target = repo.create(VocabularyName("Frank Herbert")).entry
        val books = ExposedBookRepository()
        val shared = book("Shared", authors = listOf(source, target))
        val onlySource = book("Only source", authors = listOf(source))
        val onlyTarget = book("Only target", authors = listOf(target))
        listOf(shared, onlySource, onlyTarget).forEach { books.insert(it) }

        repo.merge(source.id, target.id)

        assertEquals(listOf(target), books.findById(shared.id)!!.authors)
        assertEquals(listOf(BookAuthorSummary(target, 3)), repo.findSummaries())
    }

    @Test
    fun `merge with an unknown source or target is not found and changes nothing`() = withFreshDatabase {
        val repo = ExposedBookAuthorRepository()
        val known = repo.create(VocabularyName("Frank Herbert")).entry

        assertEquals(MergeOutcome.SourceNotFound, repo.merge(BookAuthorId.new(), known.id))
        assertEquals(MergeOutcome.TargetNotFound, repo.merge(known.id, BookAuthorId.new()))
        assertEquals(listOf(known), repo.findByIds(setOf(known.id)))
    }
}
