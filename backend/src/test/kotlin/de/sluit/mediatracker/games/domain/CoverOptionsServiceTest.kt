package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.SearchTerm
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.confirmVerified
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.uuid.Uuid

/**
 * Mocks only [GameRepository] and [CoverSource] (the persistence and integration ports); everything else is
 * real, so these tests exercise the actual term-derivation and ranking-selection logic.
 */
class CoverOptionsServiceTest {
    private val games = mockk<GameRepository>()
    private val source = mockk<CoverSource>()
    private val service = CoverOptionsService(games, source)

    private fun platform(label: String = "PC") =
        GamePlatform(GamePlatformId(Uuid.random()), PlatformLabel(label), HexColor("757575"))

    private fun game(title: String, releaseYear: Int = 2020, id: GameId = GameId.new()) = Game(
        id = id,
        title = Title(title),
        releaseYear = ReleaseYear(releaseYear),
        platforms = listOf(platform()),
    )

    private fun candidate(name: String, id: Long = 1) =
        CoverCandidate(id = CoverSourceGameId(id), name = name, releaseYear = null, verified = true)

    private fun cover(id: Long = 1) = CoverOption(
        thumbnailUrl = CoverImageUrl("https://example.org/thumb-$id.png"),
        imageUrl = CoverImageUrl("https://example.org/full-$id.png"),
        width = 600,
        height = 900,
    )

    @Test
    fun `throws unavailable without touching the repository when no source is configured`() = runBlocking {
        val serviceWithoutSource = CoverOptionsService(games, source = null)

        val exception = assertFailsWith<ExternalSourceUnavailableException> {
            serviceWithoutSource.find(
                GameId.new(),
                query = null,
                match = null,
                type = CoverType.STATIC,
                page = PageNumber.FIRST,
            )
        }

        assertEquals(CoverOptionsService.SOURCE, exception.source)
        coVerify(exactly = 0) { games.findById(any()) }
    }

    @Test
    fun `throws not found for an unknown game`() = runBlocking {
        val gameId = GameId.new()
        coEvery { games.findById(gameId) } returns null

        val exception = assertFailsWith<NotFoundException> {
            service.find(gameId, query = null, match = null, type = CoverType.STATIC, page = PageNumber.FIRST)
        }

        assertEquals(gameId.toString(), exception.id)
    }

    @Test
    fun `defaults the search term to the game title`() = runBlocking {
        val theGame = game("Hades")
        coEvery { games.findById(theGame.id) } returns theGame
        coEvery { source.searchGames(SearchTerm("Hades")) } returns emptyList()

        val result = service.find(
            theGame.id,
            query = null,
            match = null,
            type = CoverType.STATIC,
            page = PageNumber.FIRST,
        )

        assertEquals(SearchTerm("Hades"), result.query)
        coVerify { source.searchGames(SearchTerm("Hades")) }
    }

    @Test
    fun `truncates a long title to a valid search term`() = runBlocking {
        val longTitle = "x".repeat(256)
        val theGame = game(longTitle)
        val expectedTerm = SearchTerm(longTitle.take(SearchTerm.MAX_LENGTH))
        coEvery { games.findById(theGame.id) } returns theGame
        coEvery { source.searchGames(expectedTerm) } returns emptyList()

        val result = service.find(
            theGame.id,
            query = null,
            match = null,
            type = CoverType.STATIC,
            page = PageNumber.FIRST,
        )

        assertEquals(expectedTerm, result.query)
    }

    @Test
    fun `an explicit query overrides the title`() = runBlocking {
        val theGame = game("Hades")
        val query = SearchTerm("Hades 2")
        coEvery { games.findById(theGame.id) } returns theGame
        coEvery { source.searchGames(query) } returns emptyList()

        val result = service.find(
            theGame.id,
            query = query,
            match = null,
            type = CoverType.STATIC,
            page = PageNumber.FIRST,
        )

        assertEquals(query, result.query)
        coVerify { source.searchGames(query) }
    }

    @Test
    fun `an explicit match skips ranking but still searches`() = runBlocking {
        val theGame = game("Hades")
        val matches = listOf(candidate("Hades", id = 1), candidate("Hades II", id = 2))
        val chosen = CoverSourceGameId(2)
        coEvery { games.findById(theGame.id) } returns theGame
        coEvery { source.searchGames(SearchTerm("Hades")) } returns matches
        coEvery { source.findCovers(chosen, CoverType.STATIC, PageNumber.FIRST) } returns
            Page(listOf(cover(2)), PageNumber.FIRST, PageSize(1), 1)

        val result = service.find(
            theGame.id,
            query = null,
            match = chosen,
            type = CoverType.STATIC,
            page = PageNumber.FIRST,
        )

        assertEquals(chosen, result.selectedMatchId)
        assertEquals(matches, result.matches)
        coVerify { source.searchGames(SearchTerm("Hades")) }
        coVerify { source.findCovers(chosen, CoverType.STATIC, PageNumber.FIRST) }
        confirmVerified(source)
    }

    @Test
    fun `an explicit match on a later page skips the search and fetches covers for that page`() = runBlocking {
        val theGame = game("Hades")
        val chosen = CoverSourceGameId(2)
        coEvery { games.findById(theGame.id) } returns theGame
        coEvery { source.findCovers(chosen, CoverType.STATIC, PageNumber(2)) } returns
            Page(listOf(cover(2)), PageNumber(2), PageSize(1), 1)

        val result = service.find(
            theGame.id,
            query = null,
            match = chosen,
            type = CoverType.STATIC,
            page = PageNumber(2),
        )

        assertEquals(chosen, result.selectedMatchId)
        assertEquals(emptyList(), result.matches)
        coVerify { source.findCovers(chosen, CoverType.STATIC, PageNumber(2)) }
        confirmVerified(source)
    }

    @Test
    fun `covers are fetched only for the selected match`() = runBlocking {
        val theGame = game("Hades")
        val matches = listOf(candidate("Hades", id = 1))
        coEvery { games.findById(theGame.id) } returns theGame
        coEvery { source.searchGames(SearchTerm("Hades")) } returns matches
        coEvery { source.findCovers(CoverSourceGameId(1), CoverType.STATIC, PageNumber.FIRST) } returns
            Page(listOf(cover(1)), PageNumber.FIRST, PageSize(1), 1)

        val result = service.find(
            theGame.id,
            query = null,
            match = null,
            type = CoverType.STATIC,
            page = PageNumber.FIRST,
        )

        assertEquals(CoverSourceGameId(1), result.selectedMatchId)
        assertEquals(listOf(cover(1)), result.covers.items)
        coVerify { source.findCovers(CoverSourceGameId(1), CoverType.STATIC, PageNumber.FIRST) }
    }

    @Test
    fun `type and page are passed unchanged to findCovers for the selected match`() = runBlocking {
        val theGame = game("Hades")
        val matches = listOf(candidate("Hades", id = 1))
        coEvery { games.findById(theGame.id) } returns theGame
        coEvery { source.searchGames(SearchTerm("Hades")) } returns matches
        coEvery { source.findCovers(CoverSourceGameId(1), CoverType.ANIMATED, PageNumber(3)) } returns
            Page(listOf(cover(1)), PageNumber(3), PageSize(1), 1)

        service.find(theGame.id, query = null, match = null, type = CoverType.ANIMATED, page = PageNumber(3))

        coVerify { source.findCovers(CoverSourceGameId(1), CoverType.ANIMATED, PageNumber(3)) }
    }

    @Test
    fun `no selected match returns an empty page at the requested page number`() = runBlocking {
        val theGame = game("Hades")
        coEvery { games.findById(theGame.id) } returns theGame
        coEvery { source.searchGames(SearchTerm("Hades")) } returns emptyList()

        val result = service.find(
            theGame.id,
            query = null,
            match = null,
            type = CoverType.ANIMATED,
            page = PageNumber(3),
        )

        assertEquals(0, result.covers.totalItems)
        assertEquals(PageNumber(3), result.covers.page)
    }

    @Test
    fun `the returned type echoes the requested type`() = runBlocking {
        val theGame = game("Hades")
        val matches = listOf(candidate("Hades", id = 1))
        coEvery { games.findById(theGame.id) } returns theGame
        coEvery { source.searchGames(SearchTerm("Hades")) } returns matches
        coEvery { source.findCovers(CoverSourceGameId(1), CoverType.ANIMATED, PageNumber.FIRST) } returns
            Page(listOf(cover(1)), PageNumber.FIRST, PageSize(1), 1)

        val result = service.find(
            theGame.id,
            query = null,
            match = null,
            type = CoverType.ANIMATED,
            page = PageNumber.FIRST,
        )

        assertEquals(CoverType.ANIMATED, result.type)
    }

    @Test
    fun `no matches means no covers are fetched and no match is selected`() = runBlocking {
        val theGame = game("Hades")
        coEvery { games.findById(theGame.id) } returns theGame
        coEvery { source.searchGames(SearchTerm("Hades")) } returns emptyList()

        val result = service.find(
            theGame.id,
            query = null,
            match = null,
            type = CoverType.STATIC,
            page = PageNumber.FIRST,
        )

        assertNull(result.selectedMatchId)
        assertEquals(emptyList(), result.covers.items)
        // confirmVerified after verifying the one expected call, rather than coVerify(exactly = 0) with a
        // matcher: MockK's any()/isNull() witness generation for a value class always constructs a real instance
        // and would trip CoverSourceGameId's `value > 0` check about half the time.
        coVerify { source.searchGames(SearchTerm("Hades")) }
        confirmVerified(source)
    }
}
