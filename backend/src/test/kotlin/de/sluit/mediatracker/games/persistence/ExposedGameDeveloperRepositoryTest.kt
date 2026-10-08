package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import de.sluit.mediatracker.games.domain.GameDeveloperId
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ExposedGameDeveloperRepositoryTest {

    @Test
    fun `search with no term lists developers alphabetically`() = withFreshDatabase {
        val repo = ExposedGameDeveloperRepository()
        repo.create(VocabularyName("Monolith Soft"))
        repo.create(VocabularyName("Nintendo EPD"))

        val result = repo.search(null, VocabularySearchLimit.DEFAULT)

        assertEquals(listOf("Monolith Soft", "Nintendo EPD"), result.map { it.name.value })
    }

    @Test
    fun `search matches a name prefix`() = withFreshDatabase {
        val repo = ExposedGameDeveloperRepository()
        val nintendo = repo.create(VocabularyName("Nintendo EPD")).entry
        repo.create(VocabularyName("Monolith Soft"))

        val result = repo.search(SearchTerm("nin"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf(nintendo.id), result.map { it.id })
    }

    @Test
    fun `search finds a two-letter name by its one-character prefix`() = withFreshDatabase {
        // InnoDB never indexes a word shorter than innodb_ft_min_token_size (3), so a name as short as "EA" has
        // no fulltext entry at all; only the LIKE-prefix fallback (MT-025) can find it.
        val repo = ExposedGameDeveloperRepository()
        val ea = repo.create(VocabularyName("EA")).entry
        repo.create(VocabularyName("Monolith Soft"))

        val result = repo.search(SearchTerm("e"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf(ea.id), result.map { it.id })
    }

    @Test
    fun `search finds a two-letter name by its full two-character prefix`() = withFreshDatabase {
        val repo = ExposedGameDeveloperRepository()
        val ea = repo.create(VocabularyName("EA")).entry
        repo.create(VocabularyName("Monolith Soft"))

        val result = repo.search(SearchTerm("ea"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf(ea.id), result.map { it.id })
    }

    @Test
    fun `search with only operator characters lists developers alphabetically`() = withFreshDatabase {
        // FulltextQuery.booleanMode strips every operator character; nothing searchable is left, so this falls
        // back to the same alphabetical listing as no term at all - consistent with ExposedGameRepository.search.
        val repo = ExposedGameDeveloperRepository()
        repo.create(VocabularyName("Nintendo EPD"))
        repo.create(VocabularyName("Monolith Soft"))

        val result = repo.search(SearchTerm("+-*"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf("Monolith Soft", "Nintendo EPD"), result.map { it.name.value })
    }

    @Test
    fun `search ranks a LIKE-prefix hit above a fulltext-only match for a multi-word query`() = withFreshDatabase {
        val repo = ExposedGameDeveloperRepository()
        // "EA" is too short to be indexed, so only the literal "ea sports" LIKE prefix finds this one that way;
        // it also happens to match the fulltext query through its "Sports" word.
        val eaSports = repo.create(VocabularyName("EA Sports")).entry
        // Matches only through the fulltext "sports*" term, never the literal "ea sports" prefix.
        val rockstarSports = repo.create(VocabularyName("Rockstar Sports")).entry

        val result = repo.search(SearchTerm("ea sports"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf(eaSports.id, rockstarSports.id), result.map { it.id })
    }

    @Test
    fun `search caps the result at the given limit`() = withFreshDatabase {
        val repo = ExposedGameDeveloperRepository()
        (1..3).forEach { repo.create(VocabularyName("Studio $it")) }

        val result = repo.search(null, VocabularySearchLimit(2))

        assertEquals(2, result.size)
    }

    @Test
    fun `create is idempotent for a case-insensitive existing name`() = withFreshDatabase {
        val repo = ExposedGameDeveloperRepository()
        val first = repo.create(VocabularyName("Nintendo EPD"))
        assertTrue(first.created)

        val second = repo.create(VocabularyName("nintendo epd"))

        assertTrue(!second.created)
        assertEquals(first.entry.id, second.entry.id)
    }

    /**
     * Deterministic counterpart to the fully concurrent test below: [ExposedGameDeveloperRepository.create]'s
     * internal test seam commits a competing insert of the same name, on its own connection, in the exact window
     * between the initial lookup and this call's own insert - the same window the duplicate-key fallback exists
     * for - so this always exercises the fallback read itself rather than relying on Exposed's transaction retry
     * to eventually paper over a deadlock.
     */
    @Test
    fun `create falls back to the locking read when a competing insert commits mid-transaction`() = withFreshDatabase {
        val repo = ExposedGameDeveloperRepository()
        val name = VocabularyName("Nintendo EPD")
        var winnerId: GameDeveloperId? = null

        val result = repo.create(name) {
            val thread = Thread {
                transaction {
                    val id = GameDeveloperId.new()
                    winnerId = id
                    GameDevelopersTable.insert {
                        it[GameDevelopersTable.id] = id.toString()
                        it[GameDevelopersTable.name] = name.value
                    }
                }
            }
            thread.start()
            thread.join()
        }

        assertTrue(!result.created)
        assertEquals(winnerId, result.entry.id)
        val rowCount = transaction {
            GameDevelopersTable.selectAll().where { GameDevelopersTable.name eq name.value }.count()
        }
        assertEquals(1, rowCount)
    }

    @Test
    fun `search escapes a literal underscore so it does not act as a single-character wildcard`() = withFreshDatabase {
        val repo = ExposedGameDeveloperRepository()
        val underscoreName = repo.create(VocabularyName("X_")).entry
        // Both names are too short for fulltext to index at all (below innodb_ft_min_token_size), so only the
        // LIKE-prefix fallback can find either of them, isolating the escaping behaviour under test.
        repo.create(VocabularyName("XY"))

        val result = repo.search(SearchTerm("x_"), VocabularySearchLimit.DEFAULT)

        assertEquals(listOf(underscoreName.id), result.map { it.id })
    }

    @Test
    fun `findByIds returns only the requested developers`() = withFreshDatabase {
        val repo = ExposedGameDeveloperRepository()
        val nintendo = repo.create(VocabularyName("Nintendo EPD")).entry
        repo.create(VocabularyName("Monolith Soft"))

        val result = repo.findByIds(setOf(nintendo.id))

        assertEquals(listOf(nintendo), result)
    }

    @Test
    fun `findByIds with an empty set returns an empty list`() = withFreshDatabase {
        val repo = ExposedGameDeveloperRepository()

        assertEquals(emptyList(), repo.findByIds(emptySet()))
    }

    /**
     * Non-deterministic by nature (which coroutine wins the unique-index race depends on scheduling and the
     * shared pool's connection timing), so many parallel attempts rather than exactly two: with only a
     * two-connection test pool ([de.sluit.mediatracker.common.persistence.testDatabaseConfig]), some pair of
     * these is virtually certain to overlap and exercise the race in [ExposedGameDeveloperRepository.create]'s
     * duplicate-key fallback (MT-025). Every attempt must still agree on one id and the table must hold exactly
     * one row for the name, whichever one happened to win.
     */
    @Test
    fun `concurrent create for the same name never yields two ids or two rows`() = withFreshDatabase {
        val repo = ExposedGameDeveloperRepository()
        val name = VocabularyName("Nintendo EPD")

        val results = coroutineScope {
            (1..20).map { async { repo.create(name) } }.awaitAll()
        }

        assertEquals(1, results.map { it.entry.id }.toSet().size)
        val rowCount = transaction {
            GameDevelopersTable.selectAll().where { GameDevelopersTable.name eq name.value }.count()
        }
        assertEquals(1, rowCount)
    }
}
