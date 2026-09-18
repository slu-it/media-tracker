package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.persistence.countStatements
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.domain.CoverImageUrl
import de.sluit.mediatracker.games.domain.Description
import de.sluit.mediatracker.games.domain.GameId
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
            }
        }

        assertFailsWith<InvalidValueException> { repo.findById(id) }
    }

    @Test
    fun `findPage orders by title then id and reports totals`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val firstA = game("A", id = GameId.parse("00000000-0000-0000-0000-000000000001"))
        val secondA = game("A", id = GameId.parse("00000000-0000-0000-0000-000000000002"))
        val b = game("B", id = GameId.new())
        repo.insert(b)
        repo.insert(secondA)
        repo.insert(firstA)

        val page = repo.findPage(PageRequest())

        assertEquals(listOf(firstA.id, secondA.id, b.id), page.items.map { it.id })
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
}
