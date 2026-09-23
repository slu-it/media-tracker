package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.SearchTerm
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class CoverMatchRankingTest {
    private fun candidate(name: String, releaseYear: Int? = null, id: Long = 1, verified: Boolean = true) =
        CoverCandidate(
            id = CoverSourceGameId(id),
            name = name,
            releaseYear = releaseYear?.let { ReleaseYear(it) },
            verified = verified,
        )

    @Test
    fun `an exact title match beats the first candidate`() {
        val first = candidate("Hades II", id = 1)
        val exact = candidate("Hades", id = 2)

        val result = selectBestMatch(listOf(first, exact), SearchTerm("Hades"), ReleaseYear(2020))

        assertEquals(exact, result)
    }

    @Test
    fun `exact matching is case and whitespace insensitive`() {
        val exact = candidate("  hades   the  game  ", id = 1)

        val result = selectBestMatch(listOf(exact), SearchTerm("Hades the game"), ReleaseYear(2020))

        assertEquals(exact, result)
    }

    @Test
    fun `among several exact matches the same release year wins`() {
        val wrongYear = candidate("Hades", releaseYear = 2018, id = 1)
        val rightYear = candidate("Hades", releaseYear = 2020, id = 2)

        val result = selectBestMatch(listOf(wrongYear, rightYear), SearchTerm("Hades"), ReleaseYear(2020))

        assertEquals(rightYear, result)
    }

    @Test
    fun `among several exact matches with no release year hit the first one wins`() {
        val first = candidate("Hades", releaseYear = 2018, id = 1)
        val second = candidate("Hades", releaseYear = 2019, id = 2)

        val result = selectBestMatch(listOf(first, second), SearchTerm("Hades"), ReleaseYear(2020))

        assertEquals(first, result)
    }

    @Test
    fun `without a release year the first exact title match wins`() {
        val first = candidate("Hades", releaseYear = 2018, id = 1)
        val second = candidate("Hades", releaseYear = 2019, id = 2)

        val result = selectBestMatch(listOf(first, second), SearchTerm("Hades"), releaseYear = null)

        assertEquals(first, result)
    }

    @Test
    fun `no exact match falls back to the first candidate`() {
        val first = candidate("Hades II", id = 1)
        val second = candidate("Hades: Battle Out of Hell", id = 2)

        val result = selectBestMatch(listOf(first, second), SearchTerm("Hades"), ReleaseYear(2020))

        assertEquals(first, result)
    }

    @Test
    fun `no candidates means no match`() {
        val result = selectBestMatch(emptyList(), SearchTerm("Hades"), ReleaseYear(2020))

        assertNull(result)
    }
}
