package de.sluit.mediatracker.common.domain

import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ReleaseDatingTest {
    private val date = ReleaseDate(LocalDate.of(1995, 11, 21))

    @Test
    fun `a date whose year differs from the release year is rejected`() {
        val e = assertFailsWith<InvalidValueException> { requireReleaseYearMatches(ReleaseYear(2020), date) }
        assertEquals("releaseDate", e.field)
        requireReleaseYearMatches(ReleaseYear(1995), date)
        requireReleaseYearMatches(ReleaseYear(2020), null)
    }

    @Test
    fun `effective release year is the date's year when a date is given`() {
        assertEquals(ReleaseYear(1995), effectiveReleaseYear(ReleaseYear(2020), date))
        assertEquals(ReleaseYear(2020), effectiveReleaseYear(ReleaseYear(2020), null))
    }

    @Test
    fun `patched release year prefers the date then the patch year then the current year`() {
        assertEquals(ReleaseYear(1995), resolvePatchedReleaseYear(ReleaseYear(1999), date, ReleaseYear(2020)))
        assertEquals(ReleaseYear(1999), resolvePatchedReleaseYear(ReleaseYear(1999), null, ReleaseYear(2020)))
        assertEquals(ReleaseYear(2020), resolvePatchedReleaseYear(null, null, ReleaseYear(2020)))
    }

    @Test
    fun `release year from a request prefers the year then the date and otherwise fails`() {
        assertEquals(ReleaseYear(2020), releaseYearFromYearOrDate(2020, date))
        assertEquals(ReleaseYear(1995), releaseYearFromYearOrDate(null, date))
        val e = assertFailsWith<InvalidValueException> { releaseYearFromYearOrDate(null, null) }
        assertEquals("releaseYear", e.field)
        assertEquals("is required unless releaseDate is given", e.reason)
    }
}
