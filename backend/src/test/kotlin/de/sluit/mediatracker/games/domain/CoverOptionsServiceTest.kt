package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
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

/**
 * Mocks only [CoverSource] (the integration port); everything else is real, so these tests exercise the actual
 * ranking-selection logic.
 */
class CoverOptionsServiceTest {
    private val source = mockk<CoverSource>()
    private val service = CoverOptionsService(source)

    private fun candidate(name: String, id: Long = 1, releaseYear: Int? = null) = CoverCandidate(
        id = CoverSourceGameId(id),
        name = name,
        releaseYear = releaseYear?.let(::ReleaseYear),
        verified = true,
    )

    private fun cover(id: Long = 1) = CoverOption(
        thumbnailUrl = CoverImageUrl("https://example.org/thumb-$id.png"),
        imageUrl = CoverImageUrl("https://example.org/full-$id.png"),
        width = 600,
        height = 900,
    )

    @Test
    fun `throws unavailable without touching the source when no source is configured`() = runBlocking {
        val serviceWithoutSource = CoverOptionsService(source = null)

        val exception = assertFailsWith<ExternalSourceUnavailableException> {
            serviceWithoutSource.find(
                query = SearchTerm("Hades"),
                releaseYear = null,
                match = null,
                type = CoverType.STATIC,
                page = PageNumber.FIRST,
            )
        }

        assertEquals(CoverOptionsService.SOURCE, exception.source)
        confirmVerified(source)
    }

    @Test
    fun `an explicit match skips ranking but still searches`() = runBlocking {
        val matches = listOf(candidate("Hades", id = 1), candidate("Hades II", id = 2))
        val chosen = CoverSourceGameId(2)
        coEvery { source.searchGames(SearchTerm("Hades")) } returns matches
        coEvery { source.findCovers(chosen, CoverType.STATIC, PageNumber.FIRST) } returns
            Page(listOf(cover(2)), PageNumber.FIRST, PageSize(1), 1)

        val result = service.find(
            query = SearchTerm("Hades"),
            releaseYear = null,
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
        val chosen = CoverSourceGameId(2)
        coEvery { source.findCovers(chosen, CoverType.STATIC, PageNumber(2)) } returns
            Page(listOf(cover(2)), PageNumber(2), PageSize(1), 1)

        val result = service.find(
            query = SearchTerm("Hades"),
            releaseYear = null,
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
        val matches = listOf(candidate("Hades", id = 1))
        coEvery { source.searchGames(SearchTerm("Hades")) } returns matches
        coEvery { source.findCovers(CoverSourceGameId(1), CoverType.STATIC, PageNumber.FIRST) } returns
            Page(listOf(cover(1)), PageNumber.FIRST, PageSize(1), 1)

        val result = service.find(
            query = SearchTerm("Hades"),
            releaseYear = null,
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
        val matches = listOf(candidate("Hades", id = 1))
        coEvery { source.searchGames(SearchTerm("Hades")) } returns matches
        coEvery { source.findCovers(CoverSourceGameId(1), CoverType.ANIMATED, PageNumber(3)) } returns
            Page(listOf(cover(1)), PageNumber(3), PageSize(1), 1)

        service.find(
            query = SearchTerm("Hades"),
            releaseYear = null,
            match = null,
            type = CoverType.ANIMATED,
            page = PageNumber(3),
        )

        coVerify { source.findCovers(CoverSourceGameId(1), CoverType.ANIMATED, PageNumber(3)) }
    }

    @Test
    fun `no selected match returns an empty page at the requested page number`() = runBlocking {
        coEvery { source.searchGames(SearchTerm("Hades")) } returns emptyList()

        val result = service.find(
            query = SearchTerm("Hades"),
            releaseYear = null,
            match = null,
            type = CoverType.ANIMATED,
            page = PageNumber(3),
        )

        assertEquals(0, result.covers.totalItems)
        assertEquals(PageNumber(3), result.covers.page)
    }

    @Test
    fun `the returned type echoes the requested type`() = runBlocking {
        val matches = listOf(candidate("Hades", id = 1))
        coEvery { source.searchGames(SearchTerm("Hades")) } returns matches
        coEvery { source.findCovers(CoverSourceGameId(1), CoverType.ANIMATED, PageNumber.FIRST) } returns
            Page(listOf(cover(1)), PageNumber.FIRST, PageSize(1), 1)

        val result = service.find(
            query = SearchTerm("Hades"),
            releaseYear = null,
            match = null,
            type = CoverType.ANIMATED,
            page = PageNumber.FIRST,
        )

        assertEquals(CoverType.ANIMATED, result.type)
    }

    @Test
    fun `no matches means no covers are fetched and no match is selected`() = runBlocking {
        coEvery { source.searchGames(SearchTerm("Hades")) } returns emptyList()

        val result = service.find(
            query = SearchTerm("Hades"),
            releaseYear = null,
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

    @Test
    fun `a null release year still ranks by title`() = runBlocking {
        val matches = listOf(candidate("Hades II", id = 1), candidate("Hades", id = 2))
        coEvery { source.searchGames(SearchTerm("Hades")) } returns matches
        coEvery { source.findCovers(CoverSourceGameId(2), CoverType.STATIC, PageNumber.FIRST) } returns
            Page(listOf(cover(2)), PageNumber.FIRST, PageSize(1), 1)

        val result = service.find(
            query = SearchTerm("Hades"),
            releaseYear = null,
            match = null,
            type = CoverType.STATIC,
            page = PageNumber.FIRST,
        )

        assertEquals(CoverSourceGameId(2), result.selectedMatchId)
    }

    @Test
    fun `the release year is used to break ties between exact title matches`() = runBlocking {
        val wrongYear = candidate("Hades", id = 1, releaseYear = 2018)
        val rightYear = candidate("Hades", id = 2, releaseYear = 2020)
        coEvery { source.searchGames(SearchTerm("Hades")) } returns listOf(wrongYear, rightYear)
        coEvery { source.findCovers(CoverSourceGameId(2), CoverType.STATIC, PageNumber.FIRST) } returns
            Page(listOf(cover(2)), PageNumber.FIRST, PageSize(1), 1)

        val result = service.find(
            query = SearchTerm("Hades"),
            releaseYear = ReleaseYear(2020),
            match = null,
            type = CoverType.STATIC,
            page = PageNumber.FIRST,
        )

        assertEquals(CoverSourceGameId(2), result.selectedMatchId)
    }
}
