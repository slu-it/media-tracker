package de.sluit.mediatracker.common.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class SearchTermTest {
    @Test
    fun `a blank search term is rejected naming the search field`() {
        val exception = assertFailsWith<InvalidValueException> { SearchTerm("   ") }

        assertEquals(SearchTerm.FIELD, exception.field)
    }

    @Test
    fun `a search term with surrounding whitespace is rejected`() {
        val exception = assertFailsWith<InvalidValueException> { SearchTerm(" zelda ") }

        assertEquals(SearchTerm.FIELD, exception.field)
    }

    @Test
    fun `a search term over 200 characters is rejected`() {
        val exception = assertFailsWith<InvalidValueException> { SearchTerm("x".repeat(201)) }

        assertEquals(SearchTerm.FIELD, exception.field)
    }

    @Test
    fun `parseOrNull returns null for absent and blank input`() {
        assertNull(SearchTerm.parseOrNull(null))
        assertNull(SearchTerm.parseOrNull(""))
        assertNull(SearchTerm.parseOrNull("   "))
    }

    @Test
    fun `parseOrNull trims and keeps the inner text`() {
        assertEquals(SearchTerm("zelda breath"), SearchTerm.parseOrNull("  zelda breath  "))
    }

    @Test
    fun `parseOrNull reports the given field name when the trimmed value is too long`() {
        val exception = assertFailsWith<InvalidValueException> {
            SearchTerm.parseOrNull("  ${"x".repeat(201)}  ", field = "query")
        }

        assertEquals("query", exception.field)
    }
}
