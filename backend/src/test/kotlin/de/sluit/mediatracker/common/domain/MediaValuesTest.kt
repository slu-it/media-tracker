package de.sluit.mediatracker.common.domain

import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class MediaValuesTest {
    private fun rejects(field: String, block: () -> Any?) {
        val e = assertFailsWith<InvalidValueException> { block() }
        assertEquals(field, e.field)
    }

    @Test
    fun `title must be non-blank and at most 256 characters`() {
        rejects("title") { Title("") }
        rejects("title") { Title("   ") }
        rejects("title") { Title("x".repeat(257)) }
        assertEquals("x".repeat(256), Title("x".repeat(256)).value)
        assertEquals("Zelda", Title("Zelda").toString())
    }

    @Test
    fun `release year is a four-digit number`() {
        rejects("releaseYear") { ReleaseYear(999) }
        rejects("releaseYear") { ReleaseYear(10000) }
        assertEquals(1000, ReleaseYear(1000).value)
        assertEquals(9999, ReleaseYear(9999).value)
    }

    @Test
    fun `description must be non-blank and at most 10000 characters`() {
        rejects("description") { Description("") }
        rejects("description") { Description("   ") }
        rejects("description") { Description("x".repeat(10001)) }
        assertEquals("x".repeat(10000), Description("x".repeat(10000)).value)
    }

    @Test
    fun `hex color must be a 6-digit hex string without a leading hash`() {
        rejects("associatedColor") { HexColor("") }
        rejects("associatedColor") { HexColor("#757575") }
        rejects("associatedColor") { HexColor("75757") }
        rejects("associatedColor") { HexColor("7575759") }
        rejects("associatedColor") { HexColor("GGGGGG") }
        assertEquals("aa00FF", HexColor("aa00FF").value)
    }

    @Test
    fun `cover image url must be an absolute http(s) url of bounded length`() {
        rejects("coverImageUrl") { CoverImageUrl("") }
        rejects("coverImageUrl") { CoverImageUrl("/covers/zelda.png") }
        rejects("coverImageUrl") { CoverImageUrl("ftp://example.org/zelda.png") }
        rejects("coverImageUrl") { CoverImageUrl("http://") }
        rejects("coverImageUrl") { CoverImageUrl("not a url") }
        rejects("coverImageUrl") { CoverImageUrl("https://example.org/" + "x".repeat(2048)) }
        assertEquals("https://example.org/z.png", CoverImageUrl("https://example.org/z.png").value)
        assertEquals("http://example.org/z.png", CoverImageUrl("http://example.org/z.png").value)
    }

    @Test
    fun `release date must have a four-digit year`() {
        rejects("releaseDate") { ReleaseDate(LocalDate.of(999, 1, 1)) }
        rejects("releaseDate") { ReleaseDate(LocalDate.of(10000, 1, 1)) }
        assertEquals(1995, ReleaseDate(LocalDate.of(1995, 11, 21)).year)
    }

    @Test
    fun `release date parses only iso dates`() {
        assertEquals(LocalDate.of(1995, 11, 21), ReleaseDate.parse("1995-11-21").value)
        rejects("releaseDate") { ReleaseDate.parse("21-11-1995") }
        rejects("releaseDate") { ReleaseDate.parse("not a date") }
    }

    @Test
    fun `release year parses integers and rejects anything else`() {
        assertEquals(ReleaseYear(1995), ReleaseYear.parse("1995"))
        rejects("releaseYear") { ReleaseYear.parse("abc") }
        rejects("releaseYear") { ReleaseYear.parse("999") }
    }
}
