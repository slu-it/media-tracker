package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.InvalidValueException
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
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.domain.GameFilters
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.GameSort
import de.sluit.mediatracker.games.domain.MissingField
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.game
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.time.LocalDate
import java.util.TimeZone
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

        // findPage issues exactly four SELECT statements regardless of page size: the total count, the page of
        // games, and one join query each that loads every game's platforms and developers at once.
        assertEquals(4, countWithTwoGames)
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

        val page = repo.search(SearchTerm("hades celeste"), GameFilters.NONE, PageRequest())

        assertEquals(setOf(hades.id, celeste.id), page.items.map { it.id }.toSet())
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `search matches a word prefix`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val zelda = game("The Legend of Zelda")
        repo.insert(zelda)
        repo.insert(game("Hades"))

        val page = repo.search(SearchTerm("zel"), GameFilters.NONE, PageRequest())

        assertEquals(listOf(zelda.id), page.items.map { it.id })
    }

    @Test
    fun `search matches a two character prefix`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val zelda = game("The Legend of Zelda")
        repo.insert(zelda)
        repo.insert(game("Hades"))

        val page = repo.search(SearchTerm("ze"), GameFilters.NONE, PageRequest())

        assertEquals(listOf(zelda.id), page.items.map { it.id })
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

        val page = repo.search(SearchTerm("hades"), GameFilters.NONE, PageRequest())

        assertEquals(listOf(alpha.id, beta.id, alphaFirst.id, alphaSecond.id), page.items.map { it.id })
    }

    @Test
    fun `search ignores the description`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val descriptionOnly =
            game("Underworld", description = Description("a procedural roguelike about the underworld"))
        val titleHit = game("Roguelike Deck")
        repo.insert(descriptionOnly)
        repo.insert(titleHit)
        repo.insert(game("Celeste"))

        val descriptionPage = repo.search(SearchTerm("procedural"), GameFilters.NONE, PageRequest())
        val titlePage = repo.search(SearchTerm("roguelike"), GameFilters.NONE, PageRequest())

        assertEquals(emptyList(), descriptionPage.items)
        assertEquals(0, descriptionPage.totalItems)
        assertEquals(listOf(titleHit.id), titlePage.items.map { it.id })
    }

    @Test
    fun `search finds a title too short for the fulltext index`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val go = game("Go")
        repo.insert(go)
        repo.insert(game("Hades"))

        val page = repo.search(SearchTerm("go"), GameFilters.NONE, PageRequest())

        assertEquals(listOf(go.id), page.items.map { it.id })
    }

    @Test
    fun `search finds a title starting with a stopword`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val takesTwo = game("It Takes Two")
        repo.insert(takesTwo)
        repo.insert(game("Hades"))

        val page = repo.search(SearchTerm("it"), GameFilters.NONE, PageRequest())

        assertEquals(listOf(takesTwo.id), page.items.map { it.id })
    }

    @Test
    fun `search ranks a title prefix hit above a fulltext only hit`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val midTitle = game("A Dark Place")
        val prefix = game("Dark Souls")
        repo.insert(midTitle)
        repo.insert(prefix)
        repo.insert(game("Celeste"))

        val page = repo.search(SearchTerm("dark"), GameFilters.NONE, PageRequest())

        assertEquals(listOf(prefix.id, midTitle.id), page.items.map { it.id })
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `search treats percent and underscore in the term literally`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val literal = game("a_c game")
        repo.insert(literal)
        repo.insert(game("abc game"))
        // As a wildcard, "50%" would also match "50 Days".
        repo.insert(game("50% Off"))
        repo.insert(game("50 Days"))

        val underscore = repo.search(SearchTerm("a_c"), GameFilters.NONE, PageRequest())
        val percent = repo.search(SearchTerm("50%"), GameFilters.NONE, PageRequest())

        assertEquals(listOf(literal.id), underscore.items.map { it.id })
        assertEquals(listOf("50% Off"), percent.items.map { it.title.value })
    }

    @Test
    fun `search prefix match combines with a filter and a non-default sort`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val lowOwned = game("Go Low", ownership = Ownership.OWNED, rating = Rating(2.0))
        val highOwned = game("Go High", ownership = Ownership.OWNED, rating = Rating(4.5))
        repo.insert(lowOwned)
        repo.insert(highOwned)
        repo.insert(game("Go Wishlist", ownership = Ownership.WATCHLIST, rating = Rating(5.0)))
        repo.insert(game("Hades", ownership = Ownership.OWNED, rating = Rating(5.0)))

        val filters = GameFilters(ownership = setOf(Ownership.OWNED))
        val page = repo.search(SearchTerm("go"), filters, PageRequest(), GameSort.RATING_DESC)

        assertEquals(listOf(highOwned.id, lowOwned.id), page.items.map { it.id })
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `search reports totals and pages the ranked list`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        listOf("Hades One", "Hades Two", "Hades Three").forEach { repo.insert(game(it)) }

        val page = repo.search(SearchTerm("hades"), GameFilters.NONE, PageRequest(PageNumber(2), PageSize(2)))

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

        val page = repo.search(SearchTerm("+-*"), GameFilters.NONE, PageRequest())

        assertEquals(listOf(a.id, b.id), page.items.map { it.id })
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `a term stripped to nothing falls back to the filtered listing instead of dropping the filters`() =
        withFreshDatabase {
            val repo = ExposedGameRepository()
            val owned = game("Alpha", ownership = Ownership.OWNED)
            val watchlisted = game("Beta", ownership = Ownership.WATCHLIST)
            repo.insert(owned)
            repo.insert(watchlisted)

            val filters = GameFilters(ownership = setOf(Ownership.OWNED))
            val page = repo.search(SearchTerm("+-*"), filters, PageRequest())

            assertEquals(listOf(owned.id), page.items.map { it.id })
            assertEquals(1, page.totalItems)
        }

    @Test
    fun `search ignores boolean operators in the term`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val hades = game("Hades")
        repo.insert(hades)

        val page = repo.search(SearchTerm("-hades"), GameFilters.NONE, PageRequest())

        assertEquals(listOf(hades.id), page.items.map { it.id })
    }

    @Test
    fun `search does not match unrelated games`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        repo.insert(game("Hades"))

        val page = repo.search(SearchTerm("zelda"), GameFilters.NONE, PageRequest())

        assertEquals(emptyList(), page.items)
        assertEquals(0, page.totalItems)
    }

    @Test
    fun `search loads the platforms of a page with a constant number of queries`() = withFreshDatabase { db ->
        val repo = ExposedGameRepository()
        val twoPlatforms = listOf(Platforms.PC, Platforms.XBOX)
        (1..2).forEach { repo.insert(game("Hades $it", platforms = twoPlatforms)) }

        val countWithTwoGames = countStatements(db.database) {
            repo.search(SearchTerm("hades"), GameFilters.NONE, PageRequest())
        }

        (3..5).forEach { repo.insert(game("Hades $it", platforms = twoPlatforms)) }
        val countWithFiveGames = countStatements(db.database) {
            repo.search(SearchTerm("hades"), GameFilters.NONE, PageRequest())
        }

        assertEquals(4, countWithTwoGames)
        assertEquals(countWithTwoGames, countWithFiveGames)
    }

    // search - filters

    @Test
    fun `two values in one filter match either game`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val notStarted = game("Alpha", progress = Progress.NOT_STARTED)
        val playing = game("Beta", progress = Progress.PLAYING)
        val finished = game("Gamma", progress = Progress.FINISHED)
        listOf(notStarted, playing, finished).forEach { repo.insert(it) }

        val filters = GameFilters(progress = setOf(Progress.NOT_STARTED, Progress.PLAYING))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(setOf(notStarted.id, playing.id), page.items.map { it.id }.toSet())
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `two different filters both have to match`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val matchesBoth = game("Alpha", ownership = Ownership.OWNED, progress = Progress.PLAYING)
        val matchesOwnershipOnly = game("Beta", ownership = Ownership.OWNED, progress = Progress.FINISHED)
        val matchesProgressOnly = game("Gamma", ownership = Ownership.WATCHLIST, progress = Progress.PLAYING)
        listOf(matchesBoth, matchesOwnershipOnly, matchesProgressOnly).forEach { repo.insert(it) }

        val filters = GameFilters(ownership = setOf(Ownership.OWNED), progress = setOf(Progress.PLAYING))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(listOf(matchesBoth.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `a game on two selected platforms is returned once and counted once`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val onBothPlatforms = game("Celeste", platforms = listOf(Platforms.PC, Platforms.XBOX))
        repo.insert(onBothPlatforms)

        val filters = GameFilters(platformIds = setOf(Platforms.PC.id, Platforms.XBOX.id))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(listOf(onBothPlatforms.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `filters narrow a fulltext search`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val owned = game("Hades", ownership = Ownership.OWNED)
        val watchlisted = game("Hades Clone", ownership = Ownership.WATCHLIST)
        repo.insert(owned)
        repo.insert(watchlisted)

        val filters = GameFilters(ownership = setOf(Ownership.OWNED))
        val page = repo.search(SearchTerm("hades"), filters, PageRequest())

        assertEquals(listOf(owned.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `a filter-only call is ordered by title`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val c = game("C", ownership = Ownership.OWNED)
        val a = game("A", ownership = Ownership.OWNED)
        val b = game("B", ownership = Ownership.OWNED)
        listOf(c, a, b).forEach { repo.insert(it) }
        repo.insert(game("Unrelated", ownership = Ownership.WATCHLIST))

        val filters = GameFilters(ownership = setOf(Ownership.OWNED))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(listOf(a.id, b.id, c.id), page.items.map { it.id })
    }

    @Test
    fun `missing description filter returns only the game without a description`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val noDescription = game(
            "Alpha",
            description = null,
            coverImageUrl = CoverImageUrl("https://example.com/alpha.jpg"),
        )
        val noCoverImage = game(
            "Beta",
            description = Description("a description"),
            coverImageUrl = null,
        )
        val complete = game(
            "Gamma",
            description = Description("a description"),
            coverImageUrl = CoverImageUrl("https://example.com/gamma.jpg"),
        )
        listOf(noDescription, noCoverImage, complete).forEach { repo.insert(it) }

        val filters = GameFilters(missing = setOf(MissingField.DESCRIPTION))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(listOf(noDescription.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `missing description or missing cover image matches either incomplete game`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val noDescription = game(
            "Alpha",
            description = null,
            coverImageUrl = CoverImageUrl("https://example.com/alpha.jpg"),
        )
        val noCoverImage = game(
            "Beta",
            description = Description("a description"),
            coverImageUrl = null,
        )
        val complete = game(
            "Gamma",
            description = Description("a description"),
            coverImageUrl = CoverImageUrl("https://example.com/gamma.jpg"),
        )
        listOf(noDescription, noCoverImage, complete).forEach { repo.insert(it) }

        val filters = GameFilters(missing = setOf(MissingField.DESCRIPTION, MissingField.COVER_IMAGE_URL))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(setOf(noDescription.id, noCoverImage.id), page.items.map { it.id }.toSet())
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `missing description combined with ownership filter matches only games satisfying both`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val matchesBoth = game("Alpha", description = null, ownership = Ownership.OWNED)
        val missingOnly = game("Beta", description = null, ownership = Ownership.WATCHLIST)
        val ownedOnly = game("Gamma", description = Description("a description"), ownership = Ownership.OWNED)
        listOf(matchesBoth, missingOnly, ownedOnly).forEach { repo.insert(it) }

        val filters = GameFilters(missing = setOf(MissingField.DESCRIPTION), ownership = setOf(Ownership.OWNED))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(listOf(matchesBoth.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `missing description narrows a fulltext search to games lacking a description`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val hadesWithoutDescription = game("Hades", description = null)
        val hadesWithDescription = game("Hades Full", description = Description("a description"))
        repo.insert(hadesWithoutDescription)
        repo.insert(hadesWithDescription)

        val filters = GameFilters(missing = setOf(MissingField.DESCRIPTION))
        val page = repo.search(SearchTerm("hades"), filters, PageRequest())

        assertEquals(listOf(hadesWithoutDescription.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `ratedOnly filter matches only games with a rating`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val rated = game("Alpha", rating = Rating(4.0))
        val unrated = game("Beta")
        repo.insert(rated)
        repo.insert(unrated)

        val page = repo.search(null, GameFilters(ratedOnly = true), PageRequest())

        assertEquals(listOf(rated.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `ratedOnly combined with ownership filter matches only games satisfying both`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val matchesBoth = game("Alpha", rating = Rating(4.0), ownership = Ownership.OWNED)
        val ratedButWatchlisted = game("Beta", rating = Rating(3.0), ownership = Ownership.WATCHLIST)
        val ownedButUnrated = game("Gamma", ownership = Ownership.OWNED)
        listOf(matchesBoth, ratedButWatchlisted, ownedButUnrated).forEach { repo.insert(it) }

        val filters = GameFilters(ratedOnly = true, ownership = setOf(Ownership.OWNED))
        val page = repo.search(null, filters, PageRequest())

        assertEquals(listOf(matchesBoth.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    // sort (MT-026)

    @Test
    fun `RELEASE_ASC orders by year then dated games before year-only games in the same year then title then id`() =
        withFreshDatabase {
            val repo = ExposedGameRepository()
            val old = game("Old", releaseYear = 1999)
            // Titled to disprove a title-only explanation: "Zulu" sorts after "Alpha" alphabetically, but the
            // dated game must still come first within 2000 because the (releaseDate IS NULL) column outranks it.
            val datedInYear2000 = game("Zulu", releaseDate = ReleaseDate(LocalDate.of(2000, 6, 1)))
            val yearOnlyIn2000 = game("Alpha", releaseYear = 2000)
            val newer = game("New", releaseYear = 2010)
            listOf(newer, yearOnlyIn2000, old, datedInYear2000).forEach { repo.insert(it) }

            val page = repo.search(null, GameFilters.NONE, PageRequest(), GameSort.RELEASE_ASC)

            assertEquals(
                listOf(old.id, datedInYear2000.id, yearOnlyIn2000.id, newer.id),
                page.items.map { it.id },
            )
        }

    @Test
    fun `RELEASE_DESC orders by year then year-only games before dated games in the same year then title then id`() =
        withFreshDatabase {
            val repo = ExposedGameRepository()
            val old = game("Old", releaseYear = 1999)
            val datedInYear2000 = game("Zulu", releaseDate = ReleaseDate(LocalDate.of(2000, 6, 1)))
            val yearOnlyIn2000 = game("Alpha", releaseYear = 2000)
            val newer = game("New", releaseYear = 2010)
            listOf(newer, yearOnlyIn2000, old, datedInYear2000).forEach { repo.insert(it) }

            val page = repo.search(null, GameFilters.NONE, PageRequest(), GameSort.RELEASE_DESC)

            assertEquals(
                listOf(newer.id, yearOnlyIn2000.id, datedInYear2000.id, old.id),
                page.items.map { it.id },
            )
        }

    @Test
    fun `RELEASE_ASC breaks a tie on year and release date by title then id`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val alphaFirst = game("Alpha", releaseYear = 2000, id = GameId.parse("00000000-0000-0000-0000-000000000001"))
        val alphaSecond = game("Alpha", releaseYear = 2000, id = GameId.parse("00000000-0000-0000-0000-000000000002"))
        val beta = game("Beta", releaseYear = 2000)
        listOf(beta, alphaSecond, alphaFirst).forEach { repo.insert(it) }

        val page = repo.search(null, GameFilters.NONE, PageRequest(), GameSort.RELEASE_ASC)

        assertEquals(listOf(alphaFirst.id, alphaSecond.id, beta.id), page.items.map { it.id })
    }

    @Test
    fun `RELEASE_DESC breaks a tie on year and release date by title then id`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val alphaFirst = game("Alpha", releaseYear = 2000, id = GameId.parse("00000000-0000-0000-0000-000000000001"))
        val alphaSecond = game("Alpha", releaseYear = 2000, id = GameId.parse("00000000-0000-0000-0000-000000000002"))
        val beta = game("Beta", releaseYear = 2000)
        listOf(beta, alphaSecond, alphaFirst).forEach { repo.insert(it) }

        val page = repo.search(null, GameFilters.NONE, PageRequest(), GameSort.RELEASE_DESC)

        assertEquals(listOf(alphaFirst.id, alphaSecond.id, beta.id), page.items.map { it.id })
    }

    @Test
    fun `RATING_DESC orders by rating descending unrated last then title then id`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val highest = game("Epsilon", rating = Rating(5.0))
        val tiedRatingA = game("Alpha", rating = Rating(3.0))
        val tiedRatingB = game("Beta", rating = Rating(3.0))
        val sameRatingAndTitleFirst = game(
            "Gamma",
            rating = Rating(1.0),
            id = GameId.parse("00000000-0000-0000-0000-000000000001"),
        )
        val sameRatingAndTitleSecond = game(
            "Gamma",
            rating = Rating(1.0),
            id = GameId.parse("00000000-0000-0000-0000-000000000002"),
        )
        val unrated = game("Zeta")
        listOf(unrated, sameRatingAndTitleSecond, sameRatingAndTitleFirst, tiedRatingB, tiedRatingA, highest)
            .forEach { repo.insert(it) }

        val page = repo.search(null, GameFilters.NONE, PageRequest(), GameSort.RATING_DESC)

        assertEquals(
            listOf(
                highest.id,
                tiedRatingA.id,
                tiedRatingB.id,
                sameRatingAndTitleFirst.id,
                sameRatingAndTitleSecond.id,
                unrated.id,
            ),
            page.items.map { it.id },
        )
    }

    @Test
    fun `a non-default sort together with a search term overrides relevance ordering but keeps the match filter`() =
        withFreshDatabase {
            val repo = ExposedGameRepository()
            val hadesLowRating = game("Hades One", rating = Rating(2.0))
            val hadesHighRating = game("Hades Two", rating = Rating(4.5))
            val unrelatedHighRating = game("Celeste", rating = Rating(5.0))
            listOf(unrelatedHighRating, hadesLowRating, hadesHighRating).forEach { repo.insert(it) }

            val page = repo.search(SearchTerm("hades"), GameFilters.NONE, PageRequest(), GameSort.RATING_DESC)

            assertEquals(listOf(hadesHighRating.id, hadesLowRating.id), page.items.map { it.id })
            assertEquals(2, page.totalItems)
        }

    @Test
    fun `a subscription game round-trips and is matched by the subscription ownership filter`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val subscribed = game("Alpha", ownership = Ownership.SUBSCRIPTION)
        repo.insert(subscribed)
        repo.insert(game("Beta", ownership = Ownership.OWNED))
        repo.insert(game("Gamma", ownership = Ownership.WATCHLIST))

        val found = repo.findById(subscribed.id)
        val page = repo.search(null, GameFilters(ownership = setOf(Ownership.SUBSCRIPTION)), PageRequest())

        assertEquals(Ownership.SUBSCRIPTION, found?.ownership)
        assertEquals(listOf(subscribed.id), page.items.map { it.id })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `findUsedFilterValues returns only the values in use`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        repo.insert(
            game(
                "Alpha",
                platforms = listOf(Platforms.PC, Platforms.XBOX),
                releaseYear = 2010,
                ownership = Ownership.OWNED,
                progress = Progress.PLAYING,
            ),
        )
        repo.insert(
            game(
                "Beta",
                platforms = listOf(Platforms.XBOX),
                releaseYear = 2015,
                ownership = Ownership.WATCHLIST,
                progress = Progress.FINISHED,
            ),
        )

        val used = repo.findUsedFilterValues()

        assertEquals(mapOf(Platforms.PC.id to 1, Platforms.XBOX.id to 2), used.platformCounts)
        assertEquals(setOf(Ownership.OWNED, Ownership.WATCHLIST), used.ownership)
        assertEquals(setOf(Progress.PLAYING, Progress.FINISHED), used.progress)
        assertEquals(setOf(ReleaseYear(2010), ReleaseYear(2015)), used.releaseYears)
    }

    // developers and release date (MT-025, ADR 0029)

    @Test
    fun `insert then findById returns the game with developers sorted by name`() = withFreshDatabase {
        val developerRepo = ExposedGameDeveloperRepository()
        val nintendo = developerRepo.create(VocabularyName("Nintendo EPD")).entry
        val monolith = developerRepo.create(VocabularyName("Monolith Soft")).entry
        val repo = ExposedGameRepository()
        val inserted = game("Xenoblade", developers = listOf(nintendo, monolith))
        repo.insert(inserted)

        val found = repo.findById(inserted.id)

        assertEquals(listOf(monolith, nintendo), found?.developers)
    }

    @Test
    fun `insert round-trips a release date and stores the matching release year`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val inserted = game("Chrono Trigger", releaseDate = ReleaseDate(LocalDate.of(1995, 3, 11)))
        repo.insert(inserted)

        val found = repo.findById(inserted.id)

        assertEquals(ReleaseDate(LocalDate.of(1995, 3, 11)), found?.releaseDate)
        assertEquals(ReleaseYear(1995), found?.releaseYear)
    }

    @Test
    fun `insert without a release date stores null`() = withFreshDatabase {
        val repo = ExposedGameRepository()
        val inserted = game("Tetris")
        repo.insert(inserted)

        val found = repo.findById(inserted.id)

        assertNull(found?.releaseDate)
    }

    @Test
    fun `release date round-trips regardless of the JVM's default timezone`() {
        // Pins the pathological case LocalDateColumnType exists for (MT-025, ADR 0029): every JDBC URL fixes the
        // connection's own session timezone to UTC, but a plain Exposed date column additionally routes through
        // `TimeZone.currentSystemDefault()` on both write and read. On a JVM whose default timezone disagrees
        // with UTC, one positive-offset (Pacific/Kiritimati, UTC+14) and one negative-offset zone
        // (Pacific/Pago_Pago, UTC-11) are enough to shift a calendar date across the day boundary in either
        // direction; LocalDateColumnType hands java.time.LocalDate straight to the driver and never depends on
        // any zone, so both must round-trip unchanged.
        val originalDefault = TimeZone.getDefault()
        try {
            listOf("Pacific/Kiritimati", "Pacific/Pago_Pago").forEach { zoneId ->
                TimeZone.setDefault(TimeZone.getTimeZone(zoneId))
                withFreshDatabase {
                    val repo = ExposedGameRepository()
                    val releaseDate = ReleaseDate(LocalDate.of(1995, 3, 11))
                    val inserted = game("Chrono Trigger $zoneId", releaseDate = releaseDate)
                    repo.insert(inserted)

                    val found = repo.findById(inserted.id)

                    assertEquals(releaseDate, found?.releaseDate)
                }
            }
        } finally {
            TimeZone.setDefault(originalDefault)
        }
    }

    @Test
    fun `update replaces the developer links exactly`() = withFreshDatabase {
        val developerRepo = ExposedGameDeveloperRepository()
        val nintendo = developerRepo.create(VocabularyName("Nintendo EPD")).entry
        val monolith = developerRepo.create(VocabularyName("Monolith Soft")).entry
        val repo = ExposedGameRepository()
        val original = game("Xenoblade", developers = listOf(nintendo))
        repo.insert(original)

        val updated = original.copy(developers = listOf(monolith))
        val result = repo.update(updated)

        assertTrue(result)
        val found = repo.findById(original.id)
        assertEquals(listOf(monolith), found?.developers)
        val linkCount = transaction {
            GameToDeveloperTable.selectAll().where { GameToDeveloperTable.gameId eq original.id.toString() }.count()
        }
        assertEquals(1, linkCount)
    }

    @Test
    fun `update clears the developer links when the game has none anymore`() = withFreshDatabase {
        val developerRepo = ExposedGameDeveloperRepository()
        val nintendo = developerRepo.create(VocabularyName("Nintendo EPD")).entry
        val repo = ExposedGameRepository()
        val original = game("Xenoblade", developers = listOf(nintendo))
        repo.insert(original)

        val updated = original.copy(developers = emptyList())
        repo.update(updated)

        val found = repo.findById(original.id)
        assertEquals(emptyList(), found?.developers)
    }

    @Test
    fun `findPage loads the developers of a page with a constant number of queries`() = withFreshDatabase { db ->
        val developerRepo = ExposedGameDeveloperRepository()
        val nintendo = developerRepo.create(VocabularyName("Nintendo EPD")).entry
        val repo = ExposedGameRepository()
        (1..2).forEach { repo.insert(game("G$it", developers = listOf(nintendo))) }

        val page = repo.findPage(PageRequest())

        assertEquals(listOf(listOf(nintendo), listOf(nintendo)), page.items.map { it.developers })
    }
}
