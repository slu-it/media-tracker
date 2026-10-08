package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BookFiltersTest {
    @Test
    fun `missing field wire values are the field names`() {
        assertEquals("description", BookMissingField.DESCRIPTION.wire)
        assertEquals("coverImageUrl", BookMissingField.COVER_IMAGE_URL.wire)
    }

    @Test
    fun `missing field from round-trips every wire value`() {
        for (field in BookMissingField.entries) {
            assertEquals(field, BookMissingField.from(field.wire))
        }
    }

    @Test
    fun `missing field from an unknown value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { BookMissingField.from("bogus") }
        assertEquals(BookMissingField.FIELD, exception.field)
    }

    @Test
    fun `missing field from an empty value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { BookMissingField.from("") }
        assertEquals(BookMissingField.FIELD, exception.field)
    }

    @Test
    fun `filters are not empty when only missing is set`() {
        assertFalse(BookFilters(missing = setOf(BookMissingField.DESCRIPTION)).isEmpty)
    }

    @Test
    fun `filters are not empty when only a type is set`() {
        assertFalse(BookFilters(typeIds = setOf(BookTypeId.parse("6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0001"))).isEmpty)
    }

    @Test
    fun `NONE is empty`() {
        assertTrue(BookFilters.NONE.isEmpty)
    }
}
