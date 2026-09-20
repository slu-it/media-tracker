package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.persistence.countStatements
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.domain.CoverImageUrl
import de.sluit.mediatracker.games.domain.Description
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.domain.Title
import de.sluit.mediatracker.games.game
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ExposedGameRepositoryTest {

    @Test
    fun `insert then findById returns the game with platforms sorted by label`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val inserted = game("Celeste", platforms = listOf(Platforms.PC, Platforms.NINTENDO))
        repo.insert(inserted)
        // Rewrite the junction rows directly, in an order that differs from label order, so this test
        // cannot pass by accident: findById must sort by label itself rather than relying on insertion order.
        transaction {
            GameToPlatformTable.deleteWhere { GameToPlatformTable.gameId eq inserted.id.toString() }
            GameToPlatformTable.insert {
                it[gameId] = inserted.id.toString()
                it[platformId] = Platforms.PC.id.toString()
            }
            GameToPlatformTable.insert {
                it[gameId] = inserted.id.toString()
                it[platformId] = Platforms.NINTENDO.id.toString()
            }
        }

        val found = repo.findById(inserted.id)

        assertEquals(listOf("Nintendo", "PC"), found?.platforms?.map { it.label.value })
    }

    @Test
    fun `insert round-trips description rating and cover image url`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val inserted = game(
            "Hades",
            description = Description("A rogue-like dungeon crawler."),
            rating = Rating(4.5),
            coverImageUrl = CoverImageUrl("https://example.com/hades.jpg"),
        )
        repo.insert(inserted)

        val found = repo.findById(inserted.id)

        assertEquals(inserted, found)
    }

    @Test
    fun `insert round-trips a non-default ownership progress and hidden`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val inserted = game("Hades", ownership = Ownership.OWNED, progress = Progress.COMPLETED, hidden = true)
        repo.insert(inserted)

        val found = repo.findById(inserted.id)

        assertEquals(inserted, found)
    }

    @Test
    fun `insert stores absent optional fields as null`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val inserted = game("Tetris")
        repo.insert(inserted)

        val row = transaction { GamesTable.selectAll().where { GamesTable.id eq inserted.id.toString() }.single() }

        assertNull(row[GamesTable.description])
        assertNull(row[GamesTable.rating])
        assertNull(row[GamesTable.coverImageUrl])
    }

    @Test
    fun `findById of an unknown id returns null`() = withFreshDatabase {
        val repo = ExposedGameRepository()

        assertNull(repo.findById(GameId.new()))
    }

    @Test
    fun `findById of a game without junction rows fails validation`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val id = GameId.new()
        transaction {
            GamesTable.insert {
                it[GamesTable.id] = id.toString()
                it[title] = "Orphan"
                it[releaseYear] = 2000
                it[ownership] = Ownership.DEFAULT.wire
                it[progress] = Progress.DEFAULT.wire
                it[hidden] = false
            }
        }

        assertFailsWith<InvalidValueException> { repo.findById(id) }
    }

    @Test
    fun `findPage orders by title then id and reports totals`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val first = game("A", id = GameId.parse("00000000-0000-0000-0000-000000000001"))
        val second = game("A", id = GameId.parse("00000000-0000-0000-0000-000000000002"))
        val c = game("C")
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
        val repo = ExposedGameRepository()
        val games = (1..5).map { game("G$it") }
        games.forEach { repo.insert(it) }

        val page = repo.findPage(PageRequest(page = PageNumber(2), size = PageSize(2)))

        assertEquals(listOf("G3", "G4"), page.items.map { it.title.value })
        assertEquals(5, page.totalItems)
        assertEquals(3, page.totalPages)
    }

    @Test
    fun `findPage returns the last partial page`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val games = (1..5).map { game("G$it") }
        games.forEach { repo.insert(it) }

        val page = repo.findPage(PageRequest(page = PageNumber(3), size = PageSize(2)))

        assertEquals(listOf("G5"), page.items.map { it.title.value })
        assertEquals(5, page.totalItems)
        assertEquals(3, page.totalPages)
    }

    @Test
    fun `findPage beyond the end returns no items but the totals`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val games = (1..5).map { game("G$it") }
        games.forEach { repo.insert(it) }

        val page = repo.findPage(PageRequest(page = PageNumber(4), size = PageSize(2)))

        assertTrue(page.items.isEmpty())
        assertEquals(5, page.totalItems)
        assertEquals(3, page.totalPages)
    }

    @Test
    fun `findPage on an empty table has zero items and zero pages`() = withFreshDatabase {
        val repo = ExposedGameRepository()

        val page = repo.findPage(PageRequest())

        assertTrue(page.items.isEmpty())
        assertEquals(0, page.totalItems)
        assertEquals(0, page.totalPages)
    }

    @Test
    fun `findPage loads the platforms of a page with a constant number of queries`() = withFreshDatabase { db ->
        val repo = ExposedGameRepository()
        val twoPlatforms = listOf(Platforms.PC, Platforms.XBOX)
        (1..2).forEach { repo.insert(game("G$it", platforms = twoPlatforms)) }

        val countWithTwoGames = countStatements(db.database) { repo.findPage(PageRequest()) }

        (3..5).forEach { repo.insert(game("G$it", platforms = twoPlatforms)) }
        val countWithFiveGames = countStatements(db.database) { repo.findPage(PageRequest()) }

        // findPage issues exactly three SELECT statements regardless of page size: the total count,
        // the page of games, and one join query that loads every game's platforms at once.
        assertEquals(3, countWithTwoGames)
        assertEquals(countWithTwoGames, countWithFiveGames)
    }

    @Test
    fun `update replaces the row and its junction rows exactly`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val original = game("Celeste", platforms = listOf(Platforms.PC, Platforms.XBOX))
        repo.insert(original)

        val updated = original.copy(title = Title("Celeste (updated)"), platforms = listOf(Platforms.NINTENDO))
        val result = repo.update(updated)

        assertTrue(result)
        val found = repo.findById(original.id)
        assertEquals("Celeste (updated)", found?.title?.value)
        assertEquals(listOf(Platforms.NINTENDO), found?.platforms)
        val junctionCount = transaction {
            GameToPlatformTable.selectAll().where { GameToPlatformTable.gameId eq original.id.toString() }.count()
        }
        assertEquals(1, junctionCount)
    }

    @Test
    fun `update clears optional fields set to null`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val original = game(
            "Hades",
            description = Description("text"),
            rating = Rating(4.0),
            coverImageUrl = CoverImageUrl("https://example.com/hades.jpg"),
        )
        repo.insert(original)

        val updated = original.copy(description = null, rating = null, coverImageUrl = null)
        val result = repo.update(updated)

        assertTrue(result)
        val found = repo.findById(original.id)
        assertNull(found?.description)
        assertNull(found?.rating)
        assertNull(found?.coverImageUrl)
    }

    @Test
    fun `update changes ownership progress and hidden`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val original = game("Hades")
        repo.insert(original)

        val updated = original.copy(ownership = Ownership.OWNED, progress = Progress.PLAYING, hidden = true)
        val result = repo.update(updated)

        assertTrue(result)
        val found = repo.findById(original.id)
        assertEquals(Ownership.OWNED, found?.ownership)
        assertEquals(Progress.PLAYING, found?.progress)
        assertEquals(true, found?.hidden)
    }

    @Test
    fun `update of an unknown id returns false and writes nothing`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val unknown = game("Ghost")

        val result = repo.update(unknown)

        assertFalse(result)
        val rowCount = transaction {
            GamesTable.selectAll().where { GamesTable.id eq unknown.id.toString() }.count()
        }
        assertEquals(0, rowCount)
        val junctionCount = transaction {
            GameToPlatformTable.selectAll().where { GameToPlatformTable.gameId eq unknown.id.toString() }.count()
        }
        assertEquals(0, junctionCount)
    }

    @Test
    fun `deleteById returns 1 then 0`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val inserted = game("Celeste")
        repo.insert(inserted)

        assertEquals(1, repo.deleteById(inserted.id))
        assertEquals(0, repo.deleteById(inserted.id))
    }

    @Test
    fun `deleteById cascades to the junction rows`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val inserted = game("Celeste", platforms = listOf(Platforms.PC, Platforms.XBOX))
        repo.insert(inserted)

        repo.deleteById(inserted.id)

        val junctionCount = transaction {
            GameToPlatformTable.selectAll().where { GameToPlatformTable.gameId eq inserted.id.toString() }.count()
        }
        assertEquals(0, junctionCount)
    }

    // search

    @Test
    fun `search matches any word`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val hades = game("Hades")
        val celeste = game("Celeste")
        repo.insert(hades)
        repo.insert(celeste)

        val page = repo.search(SearchTerm("hades celeste"), PageRequest())

        assertEquals(setOf(hades.id, celeste.id), page.items.map { it.id }.toSet())
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `search matches a word prefix`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val zelda = game("The Legend of Zelda")
        repo.insert(zelda)
        repo.insert(game("Hades"))

        val page = repo.search(SearchTerm("zel"), PageRequest())

        assertEquals(listOf(zelda.id), page.items.map { it.id })
    }

    @Test
    fun `search matches a two character prefix`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val zelda = game("The Legend of Zelda")
        repo.insert(zelda)
        repo.insert(game("Hades"))

        val page = repo.search(SearchTerm("ze"), PageRequest())

        assertEquals(listOf(zelda.id), page.items.map { it.id })
    }

    @Test
    fun `search ranks a title match above a description match`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val hadesOne = game("Hades", id = GameId.parse("00000000-0000-0000-0000-000000000001"))
        val hadesTwo = game("Hades", id = GameId.parse("00000000-0000-0000-0000-000000000002"))
        val descriptionMatch = game(
            "Underworld Chronicles",
            description = Description("A roguelike inspired by Hades"),
        )
        val unrelated = game("Celeste")
        repo.insert(hadesOne)
        repo.insert(hadesTwo)
        repo.insert(descriptionMatch)
        repo.insert(unrelated)

        val page = repo.search(SearchTerm("hades"), PageRequest())

        // With plain fulltext relevance (tf * idf^2 per index) the description-only game would win here:
        // "hades" appears in 2 of the 4 titles but only 1 of the 4 descriptions, so its per-index idf is
        // higher for the description index, and the title matches split score between them. The (title hit,
        // score) ordering keeps both title hits ahead of the description-only match regardless.
        assertEquals(listOf(hadesOne.id, hadesTwo.id, descriptionMatch.id), page.items.map { it.id })
        assertEquals(3, page.totalItems)
    }

    @Test
    fun `search orders equal scores by title then id`() = withFreshDatabase {
        val beta = game("Hades Beta")
        val alpha = game("Hades Alpha")
        val alphaFirst = game("Hades Gamma", id = GameId.parse("00000000-0000-0000-0000-000000000001"))
        val alphaSecond = game("Hades Gamma", id = GameId.parse("00000000-0000-0000-0000-000000000002"))
        val repo = ExposedGameRepository()
        repo.insert(beta)
        repo.insert(alpha)
        repo.insert(alphaSecond)
        repo.insert(alphaFirst)

        val page = repo.search(SearchTerm("hades"), PageRequest())

        assertEquals(listOf(alpha.id, beta.id, alphaFirst.id, alphaSecond.id), page.items.map { it.id })
    }

    @Test
    fun `search matches the description`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val match = game("Underworld", description = Description("a roguelike about the underworld"))
        repo.insert(match)
        repo.insert(game("Celeste"))

        val page = repo.search(SearchTerm("roguelike"), PageRequest())

        assertEquals(listOf(match.id), page.items.map { it.id })
    }

    @Test
    fun `search reports totals and pages the ranked list`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        listOf("Hades One", "Hades Two", "Hades Three").forEach { repo.insert(game(it)) }

        val page = repo.search(SearchTerm("hades"), PageRequest(PageNumber(2), PageSize(2)))

        assertEquals(1, page.items.size)
        assertEquals(3, page.totalItems)
        assertEquals(2, page.totalPages)
    }

    @Test
    fun `search with only operator characters lists all games by title`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val a = game("Alpha")
        val b = game("Beta")
        repo.insert(b)
        repo.insert(a)

        val page = repo.search(SearchTerm("+-*"), PageRequest())

        assertEquals(listOf(a.id, b.id), page.items.map { it.id })
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `search ignores boolean operators in the term`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val hades = game("Hades")
        repo.insert(hades)

        val page = repo.search(SearchTerm("-hades"), PageRequest())

        assertEquals(listOf(hades.id), page.items.map { it.id })
    }

    @Test
    fun `search does not match unrelated games`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        repo.insert(game("Hades"))

        val page = repo.search(SearchTerm("zelda"), PageRequest())

        assertEquals(emptyList(), page.items)
        assertEquals(0, page.totalItems)
    }

    @Test
    fun `search loads the platforms of a page with a constant number of queries`() = withFreshDatabase { db ->
        val repo = ExposedGameRepository()
        val twoPlatforms = listOf(Platforms.PC, Platforms.XBOX)
        (1..2).forEach { repo.insert(game("Hades $it", platforms = twoPlatforms)) }

        val countWithTwoGames = countStatements(db.database) { repo.search(SearchTerm("hades"), PageRequest()) }

        (3..5).forEach { repo.insert(game("Hades $it", platforms = twoPlatforms)) }
        val countWithFiveGames = countStatements(db.database) { repo.search(SearchTerm("hades"), PageRequest()) }

        assertEquals(3, countWithTwoGames)
        assertEquals(countWithTwoGames, countWithFiveGames)
    }
}
